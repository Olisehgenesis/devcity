#!/usr/bin/env node
/**
 * Cursor Cloud Agent CLI & Client
 * Connects to Cursor Cloud Agents API (https://cursor.com/docs/cloud-agent/api/endpoints)
 */

import fs from 'node:fs';
import path from 'node:path';

// Load environment variables from .env or .env.local if not already set
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key] && !val.startsWith('encrypted:')) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // ignore errors reading env file
      }
    }
  }
}

loadEnv();

// Support HTTP/HTTPS proxy in environments that route traffic through a proxy
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy) {
  try {
    const { setGlobalDispatcher, EnvHttpProxyAgent } = await import('undici');
    if (setGlobalDispatcher && EnvHttpProxyAgent) {
      setGlobalDispatcher(new EnvHttpProxyAgent());
    }
  } catch {
    // fallback to native fetch without proxy
  }
}

const API_BASE = 'https://api.cursor.com';
const API_KEY = process.env.CURSOR_API_KEY || 'crsr_83fe43395cbae130a69e510f820d81e31efb3558937335364cae687da5f7e917';

if (!API_KEY) {
  console.error('Error: CURSOR_API_KEY is not set in environment or .env/.env.local');
  process.exit(1);
}

const authHeader = 'Basic ' + Buffer.from(`${API_KEY}:`).toString('base64');

async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    Authorization: authHeader,
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof Uint8Array)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let errorDetail;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = await response.text();
    }
    const message = errorDetail?.error?.message || errorDetail?.message || JSON.stringify(errorDetail);
    throw new Error(`API Error [${response.status} ${response.statusText}]: ${message}`);
  }

  if (contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}

/**
 * Commands
 */
export async function getMe() {
  return await apiRequest('/v1/me');
}

export async function listModels() {
  return await apiRequest('/v1/models');
}

export async function listRepositories() {
  return await apiRequest('/v1/repositories');
}

export async function listAgents(limit = 10, cursor) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return await apiRequest(`/v1/agents?${query.toString()}`);
}

export async function getAgent(agentId) {
  return await apiRequest(`/v1/agents/${agentId}`);
}

export async function createAgent({ prompt, name, repoUrl, startingRef = 'main', modelId = 'claude-sonnet-4-5', autoCreatePR = true, workOnCurrentBranch = false }) {
  const payload = {
    prompt: {
      text: prompt,
    },
    autoCreatePR,
    workOnCurrentBranch,
  };

  if (name) {
    payload.name = name;
  }

  if (modelId) {
    payload.model = { id: modelId };
  }

  if (repoUrl) {
    payload.repos = [
      {
        url: repoUrl,
        startingRef: startingRef || 'main',
      },
    ];
  }

  return await apiRequest('/v1/agents', {
    method: 'POST',
    body: payload,
  });
}

export async function createRun(agentId, prompt, modelId) {
  const payload = {
    prompt: {
      text: prompt,
    },
  };
  if (modelId) {
    payload.model = { id: modelId };
  }
  return await apiRequest(`/v1/agents/${agentId}/runs`, {
    method: 'POST',
    body: payload,
  });
}

export async function getRun(agentId, runId) {
  return await apiRequest(`/v1/agents/${agentId}/runs/${runId}`);
}

export async function cancelRun(agentId, runId) {
  return await apiRequest(`/v1/agents/${agentId}/runs/${runId}/cancel`, {
    method: 'POST',
  });
}

export async function getArtifacts(agentId) {
  return await apiRequest(`/v1/agents/${agentId}/artifacts`);
}

export async function streamRun(agentId, runId, { onText, onThinking, onToolCall, onStatus, onResult, onError } = {}) {
  const url = `${API_BASE}/v1/agents/${agentId}/runs/${runId}/stream`;
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'text/event-stream',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stream Error [${response.status}]: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = 'message';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event:')) {
        eventType = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        const rawData = trimmed.slice(5).trim();
        if (rawData === '[DONE]') return;

        let data = {};
        try {
          data = JSON.parse(rawData);
        } catch {
          data = { text: rawData };
        }

        switch (eventType) {
          case 'assistant':
            if (onText) onText(data.text || '');
            break;
          case 'thinking':
            if (onThinking) onThinking(data.text || '');
            break;
          case 'tool_call':
            if (onToolCall) onToolCall(data);
            break;
          case 'status':
            if (onStatus) onStatus(data.status);
            break;
          case 'result':
            if (onResult) onResult(data);
            break;
          case 'error':
            if (onError) onError(data);
            break;
        }
      }
    }
  }
}

/**
 * CLI parser and router
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  function getFlag(name, defaultVal = null) {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return defaultVal;
  }

  const hasFlag = (name) => args.includes(`--${name}`);

  try {
    switch (command) {
      case 'status':
      case 'whoami': {
        console.log('Connecting to Cursor Cloud Agent API...');
        const me = await getMe();
        console.log('\n--- Cursor Cloud Agent Connection Verified ---');
        console.log(`API Key Name : ${me.apiKeyName}`);
        console.log(`User         : ${me.userFirstName} ${me.userLastName}`);
        console.log(`Email        : ${me.userEmail}`);
        console.log(`User ID      : ${me.userId}`);
        console.log(`Created At   : ${me.createdAt}`);
        console.log('Status       : ACTIVE & READY\n');
        break;
      }

      case 'models': {
        console.log('Fetching available models...');
        const modelsRes = await listModels();
        const models = modelsRes.models || [];
        console.log(`\nFound ${models.length} available models:`);
        for (const m of models) {
          console.log(`- ${m.id} (${m.displayName})`);
        }
        console.log('');
        break;
      }

      case 'repos': {
        console.log('Fetching connected repositories...');
        const reposRes = await listRepositories();
        const items = reposRes.items || [];
        console.log(`\nFound ${items.length} connected repositories:`);
        for (const r of items) {
          console.log(`  ${r.url}`);
        }
        console.log('');
        break;
      }

      case 'list': {
        const limit = Number(getFlag('limit', '10'));
        console.log(`Fetching latest ${limit} agents...`);
        const res = await listAgents(limit);
        const agents = Array.isArray(res) ? res : (res.items || res.agents || []);
        console.log(`\n--- Agents (${agents.length}) ---`);
        for (const a of agents) {
          console.log(`ID     : ${a.id}`);
          console.log(`Name   : ${a.name || 'Untitled Agent'}`);
          console.log(`Status : ${a.status}`);
          if (a.repos && a.repos.length) {
            console.log(`Repo   : ${a.repos[0].url} (branch: ${a.repos[0].startingRef || 'default'})`);
            if (a.repos[0].prUrl) console.log(`PR     : ${a.repos[0].prUrl}`);
          }
          console.log(`URL    : ${a.url}`);
          console.log(`Latest Run: ${a.latestRunId || 'none'}`);
          console.log(`Updated: ${a.updatedAt}`);
          console.log('----------------------------------------------------');
        }
        break;
      }

      case 'get': {
        const agentId = args[1];
        if (!agentId) {
          console.error('Usage: cursor-agent get <agentId>');
          process.exit(1);
        }
        console.log(`Fetching agent ${agentId}...`);
        const agent = await getAgent(agentId);
        console.log(JSON.stringify(agent, null, 2));
        break;
      }

      case 'start': {
        const prompt = getFlag('prompt');
        if (!prompt) {
          console.error('Error: --prompt is required. Example: node scripts/cursor-agent.mjs start --prompt "Fix bug"');
          process.exit(1);
        }
        const name = getFlag('name', prompt.slice(0, 50));
        const repoUrl = getFlag('repo');
        const branch = getFlag('branch', 'main');
        const modelId = getFlag('model', 'claude-sonnet-4-5');
        const autoCreatePR = !hasFlag('no-pr');
        const shouldStream = hasFlag('stream') || !hasFlag('no-stream');

        console.log(`\nStarting Cursor Cloud Agent...`);
        console.log(`Prompt : "${prompt}"`);
        if (repoUrl) console.log(`Repo   : ${repoUrl} (branch: ${branch})`);
        console.log(`Model  : ${modelId}`);
        console.log(`Auto PR: ${autoCreatePR}`);

        const result = await createAgent({
          prompt,
          name,
          repoUrl,
          startingRef: branch,
          modelId,
          autoCreatePR,
        });

        const agent = result.agent;
        const run = result.run;

        console.log(`\nAgent created successfully!`);
        console.log(`Agent ID: ${agent.id}`);
        console.log(`Run ID  : ${run.id}`);
        console.log(`Web URL : ${agent.url}`);
        console.log(`Status  : ${run.status}`);

        if (shouldStream) {
          console.log('\nStreaming agent execution output...\n----------------------------------------');
          await streamRun(agent.id, run.id, {
            onText: (chunk) => process.stdout.write(chunk),
            onThinking: (chunk) => process.stdout.write(`\x1b[2m${chunk}\x1b[0m`),
            onStatus: (status) => console.log(`\n[Status: ${status}]`),
            onToolCall: (tc) => console.log(`\n[Tool Call: ${tc.name} (${tc.status})]`),
            onResult: (res) => {
              console.log('\n----------------------------------------');
              console.log(`Completed in ${res.durationMs || 0}ms.`);
              if (res.git?.branches) {
                console.log('Git branches / PR:');
                for (const b of res.git.branches) {
                  console.log(`- Branch: ${b.branch}`);
                  if (b.prUrl) console.log(`  PR URL: ${b.prUrl}`);
                }
              }
            },
            onError: (err) => console.error(`\nStream Error:`, err),
          });
          console.log('\nStream completed.');
        }
        break;
      }

      case 'stream': {
        const agentId = args[1];
        const runId = args[2];
        if (!agentId || !runId) {
          console.error('Usage: cursor-agent stream <agentId> <runId>');
          process.exit(1);
        }
        console.log(`Streaming run ${runId} of agent ${agentId}...\n`);
        await streamRun(agentId, runId, {
          onText: (chunk) => process.stdout.write(chunk),
          onThinking: (chunk) => process.stdout.write(`\x1b[2m${chunk}\x1b[0m`),
          onStatus: (status) => console.log(`\n[Status: ${status}]`),
          onToolCall: (tc) => console.log(`\n[Tool Call: ${tc.name} (${tc.status})]`),
          onResult: (res) => {
            console.log('\n\n--- Result ---');
            console.log(JSON.stringify(res, null, 2));
          },
          onError: (err) => console.error('\nStream Error:', err),
        });
        break;
      }

      case 'help':
      default: {
        console.log(`
Cursor Cloud Agent CLI
Usage:
  node scripts/cursor-agent.mjs <command> [options]

Commands:
  status, whoami     Verify API connection and print account details
  repos              List all connected GitHub/GitLab repositories
  models             List available AI models (Claude Sonnet 4.5, GPT-5.1, etc.)
  list               List cloud agents and their status
  get <agentId>      Get details of a specific agent
  start              Create an agent and start a cloud run
                     Options:
                       --prompt "<instructions>"   (Required)
                       --repo "<git_url>"         (Optional: GitHub/GitLab URL)
                       --branch "<branch_name>"   (Default: main)
                       --model "<model_id>"       (Default: claude-sonnet-4-5)
                       --name "<name>"            (Optional title)
                       --no-pr                    (Disable auto PR creation)
                       --stream                   (Live stream output to console)
  stream <agent> <run> Stream live output from an existing run
  help               Show this help message
        `);
        break;
      }
    }
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();

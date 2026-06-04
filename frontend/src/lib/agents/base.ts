// Agent abstraction layer
// Each agent receives a context (task, repo info, prisma, octokit) and returns a result.
// All agents log a TaskStep entry. Heavy LLM work happens here, isolated from API routes.

import { Octokit } from 'octokit';
import { prisma } from '../db';
import { Task } from '@prisma/client';

export type AgentContext = {
  task: Task;
  octokit: Octokit;
  owner: string;
  repo: string;
};

export type AgentResult = {
  agent: string;
  status: 'completed' | 'failed';
  summary: string;
  data?: any;
  logs?: string;
};

export async function recordStep(
  taskId: string,
  agentName: string,
  status: 'queued' | 'running' | 'completed' | 'failed',
  summary?: string,
  logs?: string,
) {
  return prisma.taskStep.create({
    data: {
      taskId,
      agentName,
      status,
      summary: summary ?? null,
      logs: logs ?? null,
    },
  });
}

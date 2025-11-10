import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

type AliasDelegates = {
  aIProvider: PrismaClient['ai_providers'];
  aIAgent: PrismaClient['ai_agents'];
  aITool: PrismaClient['ai_tools'];
  aIUsage: PrismaClient['ai_usage'];
  backlogItem: PrismaClient['backlog_items'];
  campaign: PrismaClient['campaigns'];
  ceremony: PrismaClient['ceremonies'];
  conversation: PrismaClient['conversation'];
  conversationEvent: PrismaClient['conversationEvent'];
  customField: PrismaClient['custom_fields'];
  deal: PrismaClient['deals'];
  flow: PrismaClient['flows'];
  flowEdge: PrismaClient['flow_edges'];
  flowNode: PrismaClient['flow_nodes'];
  knowledgeDocument: PrismaClient['knowledgeDocument'];
  message: PrismaClient['message'];
  product: PrismaClient['product'];
  queue: PrismaClient['queue'];
  scrumTeam: PrismaClient['scrum_teams'];
  sprint: PrismaClient['sprints'];
  user: PrismaClient['public_users'];
  videoCall: PrismaClient['video_calls'];
};

type PrismaAliasClient = PrismaClient & AliasDelegates;

const baseClient = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' }
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

const aliasDelegates: { [K in keyof AliasDelegates]: () => AliasDelegates[K] } = {
  aIProvider: () => baseClient.ai_providers,
  aIAgent: () => baseClient.ai_agents,
  aITool: () => baseClient.ai_tools,
  aIUsage: () => baseClient.ai_usage,
  backlogItem: () => baseClient.backlog_items,
  campaign: () => baseClient.campaigns,
  ceremony: () => baseClient.ceremonies,
  conversation: () => baseClient.conversation,
  conversationEvent: () => baseClient.conversationEvent,
  customField: () => baseClient.custom_fields,
  deal: () => baseClient.deals,
  flow: () => baseClient.flows,
  flowEdge: () => baseClient.flow_edges,
  flowNode: () => baseClient.flow_nodes,
  knowledgeDocument: () => baseClient.knowledgeDocument,
  message: () => baseClient.message,
  product: () => baseClient.product,
  queue: () => baseClient.queue,
  scrumTeam: () => baseClient.scrum_teams,
  sprint: () => baseClient.sprints,
  user: () => baseClient.public_users,
  videoCall: () => baseClient.video_calls,
};

export const prisma = baseClient as PrismaAliasClient;

for (const key of Object.keys(aliasDelegates) as (keyof AliasDelegates)[]) {
  Object.defineProperty(prisma, key, {
    get: aliasDelegates[key],
    enumerable: true,
  });
}

prisma.$on('query', (e: any) => {
  logger.debug({
    query: e.query,
    params: e.params,
    duration: e.duration
  }, 'Prisma Query');
});

export async function connectDatabase() {
  console.log('🔄 Tentando conectar ao banco de dados...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
  try {
    console.log('🔌 Executando prisma.$connect()...');
    await prisma.$connect();
    console.log('✅ prisma.$connect() completou');
    console.log('✅ Database connected successfully');
    logger.info('✅ Database connected');
  } catch (error) {
    logger.error({ err: error }, '❌ Database connection failed');
    throw error;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

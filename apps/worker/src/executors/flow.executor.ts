import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { FlowContext, NodeType } from '@primeflow/shared/types';
import { renderTemplate } from '@primeflow/shared/utils';
import Mustache from 'mustache';

export class FlowExecutor {
  private context: FlowContext;

  constructor(
    private flowId: string,
    private contactId: string,
    initialVars: Record<string, any> = {}
  ) {
    this.context = {
      flowId,
      contactId,
      variables: initialVars,
      currentNodeId: '',
      history: []
    };
  }

  async execute(startNodeId?: string) {
    const flow = await prisma.flows.findUnique({
      where: { id: this.flowId },
      include: {
        nodes: true,
        edges: true
      }
    });

    if (!flow) {
      throw new Error(`Flow ${this.flowId} not found`);
    }

    let currentNode = startNodeId 
      ? flow.nodes.find((n: any) => n.id === startNodeId)
      : (flow.nodes as any[]).find((n: any) => n.nodeType === 'START');

    if (!currentNode) {
      throw new Error('Start node not found');
    }

    while (currentNode) {
      logger.info({
        flowId: this.flowId,
        nodeId: currentNode.id,
        nodeType: currentNode.type
      }, 'Executing node');

      this.context.currentNodeId = currentNode.id;
      this.context.history.push(currentNode.id);

      const nextNodeId = await this.executeNode(currentNode, (flow.edges as any[]));
      
      if (!nextNodeId) {
        logger.info({ flowId: this.flowId }, 'Flow execution finished');
        break;
      }

      currentNode = flow.nodes.find(n => n.id === nextNodeId);
    }
  }

  private async executeNode(node: any, edges: any[]): Promise<string | null> {
    const config = node.config;

    const nodeType = (node.nodeType ?? node.type) as NodeType;

    switch (nodeType as NodeType) {
      case 'START':
        return this.findNextNode(node.id, edges);

      case 'CONTENT':
        await this.executeContent(config);
        return this.findNextNode(node.id, edges);

      case 'MENU':
        // Wait for user input - return null to pause
        return null;

      case 'DELAY':
        await this.executeDelay(config);
        return this.findNextNode(node.id, edges);

      case 'CONDITION':
        return this.executeCondition(config, edges);

      case 'ASSIGN_QUEUE':
        await this.executeAssignQueue(config);
        return this.findNextNode(node.id, edges);

      case 'SUBFLOW':
        await this.executeSubflow(config);
        return this.findNextNode(node.id, edges);

      default:
        logger.warn({ type: nodeType }, 'Unknown node type');
        return this.findNextNode(node.id, edges);
    }
  }

  private async executeContent(config: any) {
    const parts = config.parts || [];

    for (const part of parts) {
      const value = this.renderValue(part.value);

      // Aqui enviaria a mensagem via provider
      logger.info({
        kind: part.kind,
        value,
        ptt: part.ptt
      }, 'Send content');

      if (part.delay) {
        await this.sleep(part.delay);
      }
    }

    if (config.delay) {
      await this.sleep(config.delay);
    }
  }

  private async executeDelay(config: any) {
    await this.sleep(config.seconds * 1000);
  }

  private executeCondition(config: any, edges: any[]): string | null {
    const rules = config.rules || [];

    for (const rule of rules) {
      const left = this.renderValue(rule.left);
      const right = rule.right;

      let match = false;

      switch (rule.op) {
        case 'equals':
          match = left === right;
          break;
        case 'contains':
          match = String(left).includes(String(right));
          break;
        case 'gt':
          match = Number(left) > Number(right);
          break;
        case 'lt':
          match = Number(left) < Number(right);
          break;
        case 'in':
          match = Array.isArray(right) && right.includes(left);
          break;
      }

      if (match && rule.next) {
        return rule.next;
      }
    }

    return config.else || null;
  }

  private async executeAssignQueue(config: any) {
    logger.info({ queueId: config.queueId }, 'Assign to queue');
    // Implementar lógica de atribuição de fila
  }

  private async executeSubflow(config: any) {
    const subExecutor = new FlowExecutor(
      config.flowId,
      this.contactId,
      this.context.variables
    );
    await subExecutor.execute();
    
    // Merge variables back
    Object.assign(this.context.variables, subExecutor.getVariables());
  }

  private findNextNode(currentNodeId: string, edges: any[]): string | null {
    const edge = edges.find((e: any) => (e.sourceNodeId ?? e.sourceId) === currentNodeId);
    const target = (edge?.targetNodeId ?? edge?.targetId) as string | undefined;
    return target || null;
  }

  private renderValue(template: string): string {
    return Mustache.render(template, {
      contact: {
        id: this.contactId,
        name: ((this.context.variables as any).contact?.name) || 'Cliente'
      },
      vars: this.context.variables,
      now: new Date().toISOString()
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getVariables() {
    return this.context.variables;
  }
}

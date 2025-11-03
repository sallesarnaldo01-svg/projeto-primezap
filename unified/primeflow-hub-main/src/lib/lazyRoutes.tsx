// Lazy Loading de Rotas - Primeflow V8
import { lazy } from 'react';

// Lazy load de páginas
export const Dashboard = lazy(() => import('@/pages/Dashboard'));
export const Contacts = lazy(() => import('@/pages/Contacts'));
export const Conversations = lazy(() => import('@/pages/Conversations'));
export const Workflows = lazy(() => import('@/pages/Workflows'));
export const AIPanel = lazy(() => import('@/pages/AIPanel'));
export const Settings = lazy(() => import('@/pages/Settings'));
export const Login = lazy(() => import('@/pages/Login'));

// Lazy load de componentes pesados
export const WorkflowCanvas = lazy(() => import('@/components/WorkflowCanvas'));
export const ChatInterface = lazy(() => import('@/components/ChatInterface'));
export const AnalyticsDashboard = lazy(() => import('@/components/AnalyticsDashboard'));

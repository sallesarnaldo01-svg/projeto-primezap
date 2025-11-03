import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] captured error:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
          <h1 className="text-3xl font-semibold text-foreground">Algo deu errado</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            Detectamos um erro inesperado ao carregar esta página. Tente recarregar ou entrar em contato com o suporte se o problema persistir.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Recarregar aplicação
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

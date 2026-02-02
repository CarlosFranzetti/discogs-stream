import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              We encountered an unexpected error.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg text-left overflow-auto max-h-40 text-xs font-mono">
              {this.state.error?.message}
            </div>
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Reload Application
            </Button>
            <Button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              variant="outline"
              className="w-full"
            >
              Clear Cache & Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

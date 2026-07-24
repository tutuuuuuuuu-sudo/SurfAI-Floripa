import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { captureError } from "@/lib/monitoring"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    captureError(error, { source: 'unhandledrejection' })
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureError(error, { componentStack: errorInfo.componentStack ?? undefined })
  }

  handleReset = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-sm shadow-lg border-muted">
            <CardHeader className="space-y-2 items-center text-center pb-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <CardTitle className="text-base">Ops, algo deu errado</CardTitle>
            </CardHeader>
            <CardContent className="text-center px-4 py-2">
              <p className="text-sm text-muted-foreground">
                Encontramos um erro inesperado. Já registramos o problema — tente recarregar o app.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center p-3 border-t">
              <Button size="sm" onClick={this.handleReset} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Recarregar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

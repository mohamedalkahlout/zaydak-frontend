import { Component, type ReactNode } from 'react'
import type { GlFailure } from './camera-angle-state'

/**
 * WebGL error boundary — catches throws from inside the scene.
 */
export class WebGLErrorBoundary extends Component<
  { onFail: (reason: GlFailure, detail?: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onFail('crash', error.message)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

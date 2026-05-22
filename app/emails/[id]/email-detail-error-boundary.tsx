"use client";

import { Component, type ReactNode } from "react";
import { EmailDetailVisibleError } from "./email-detail-visible-error";

type Props = { children: ReactNode };
type State = { error: unknown | null };

export class EmailDetailErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    console.error("EMAIL DETAIL LOAD ERROR:", error);
    console.error("[email-detail] component stack", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <EmailDetailVisibleError label="EMAIL DETAIL ERROR (render):" error={this.state.error} />
      );
    }
    return this.props.children;
  }
}

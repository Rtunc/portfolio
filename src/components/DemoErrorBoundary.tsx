import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class DemoErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert">
          <p>This demo couldn't load.</p>
          <button type="button" onClick={() => this.setState({ failed: false })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

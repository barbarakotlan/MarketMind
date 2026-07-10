import React from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';


class RouteErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Route render failed', error, errorInfo);
    }

    handleRetry = () => {
        if (this.props.onRetry) {
            this.props.onRetry();
            return;
        }
        window.location.reload();
    };

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        return (
            <div className="flex min-h-[60vh] items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <TriangleAlert className="mx-auto h-9 w-9 text-mm-negative" aria-hidden="true" />
                    <h1 className="mt-4 text-xl font-semibold text-mm-text-primary">This view could not be loaded</h1>
                    <p className="mt-2 text-sm text-mm-text-secondary">
                        Your session is still active. Reload this view to try again.
                    </p>
                    <button type="button" onClick={this.handleRetry} className="ui-button-primary mt-5 inline-flex items-center gap-2 px-4 py-2">
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Reload
                    </button>
                </div>
            </div>
        );
    }
}

export default RouteErrorBoundary;

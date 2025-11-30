import { Component } from "react";

export class ErrorBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, info) {
		console.error("ErrorBoundary caught error:", error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen flex items-center justify-center text-white">
					<div className="bg-white/10 border border-white/20 rounded-xl p-6 max-w-lg text-center">
						<h2 className="text-xl text-black font-bold mb-2">Something went wrong</h2>
						<p className="text-sm text-black opacity-80 mb-2">An error occurred in the UI.</p>
						{this.state.error && <pre className="text-xs text-left text-white whitespace-pre-wrap bg-black/30 p-2 rounded mb-4 overflow-auto max-h-56">{String(this.state.error?.message || this.state.error)}</pre>}
						<button className="px-4 py-2 rounded bg-pink-600 hover:bg-pink-700" onClick={() => this.setState({ hasError: false, error: null })}>
							Try again
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

export default ErrorBoundary;

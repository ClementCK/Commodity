import { Component } from 'react'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, info) {
        console.error('App error:', error, info)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    gap: '16px',
                    padding: '40px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '48px' }}>⚠️</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Something went wrong</h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
                    >
                        Go to Dashboard
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

import React from 'react'

/**
 * GISErrorBoundary
 * Catches rendering errors in GIS maps (Leaflet) and Spatial services,
 * preventing the entire AdminLayout from crashing.
 * Provides a fallback visual and a retry button.
 */
export default class GISErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('[GISErrorBoundary] Caught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          background: 'var(--color-dark-surface)',
          padding: 'var(--space-6)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🗺️❌</div>
          <h2 style={{ color: 'var(--color-danger-400)', marginBottom: 'var(--space-2)' }}>
            Error Crítico en el Motor Espacial
          </h2>
          <p style={{ color: 'var(--color-dark-text-muted)', marginBottom: 'var(--space-6)', maxWidth: '500px' }}>
            {this.state.error?.message || 'Se produjo un error al renderizar el mapa o cargar las entidades geoespaciales.'}
          </p>
          <button 
            onClick={this.handleRetry}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-primary-600)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reintentar Conexión GIS
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

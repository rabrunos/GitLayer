import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './style.css';

class StartupBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return <main className="welcome" role="alert"><p className="eyebrow">GIT LAYERS LAB</p><h1>A interface não pôde iniciar.</h1><p>Extraia a pasta completa do ZIP antes de abrir <strong>git-layers-lab.exe</strong>. Feche o aplicativo e tente novamente.</p><p className="welcome-note">Consulte docs/WINDOWS.md. Detalhes: {this.state.error}</p><div className="welcome-buttons"><button onClick={() => window.location.reload()}>Tentar novamente</button></div></main>;
  }
}
createRoot(document.getElementById('root')!).render(<StartupBoundary><App /></StartupBoundary>);

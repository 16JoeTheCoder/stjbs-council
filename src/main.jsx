import { render } from 'preact';
import '../design/fiatlux/tokens.css';
import '../design/fiatlux/components.css';
import './app.css';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));

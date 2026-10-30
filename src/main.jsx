import { render } from 'preact';
import '../design/builtbyjosef/index.css';
import './legacy.css';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));

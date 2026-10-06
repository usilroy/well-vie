import {intentionSuggestions} from './daily-intention';
import './intention-suggestions.css';

export function IntentionSuggestions({text,onChoose,disabled=false}:{text:string;onChoose:(text:string)=>void;disabled?:boolean}) {
  return <div className="intention-suggestions" role="group" aria-label="Intention inspiration">
    <span className="small">Some inspiration</span>
    <div className="intention-suggestion-options">{intentionSuggestions.map(suggestion=><button type="button" key={suggestion}
      disabled={disabled} aria-pressed={text.trim()===suggestion} onClick={()=>onChoose(suggestion)}>{suggestion}</button>)}</div>
  </div>;
}

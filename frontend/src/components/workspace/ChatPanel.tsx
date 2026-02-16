import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../api/types';
import './ChatPanel.css';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamContent: string;
  onSend: (content: string) => void;
}

function formatContent(content: string): string {
  // Strip mermaid code blocks for display
  return content
    .replace(/```mermaid[\s\S]*?```/g, '[Architecture Diagram]')
    .replace(/```[\s\S]*?```/g, (match) => match) // keep other code blocks
    .trim();
}

export default function ChatPanel({ messages, isStreaming, streamContent, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && !isStreaming && (
          <div className="chat-welcome">
            <iconify-icon icon="solar:chat-round-dots-linear" width={28} style={{ color: 'var(--text-muted)' }} />
            <h3>Describe your architecture</h3>
            <p className="text-muted text-sm">
              Tell me what you want to build. I'll generate an architecture diagram and help you iterate on it.
            </p>
            <div className="chat-suggestions">
              {[
                'Build a SaaS with auth, API, and database',
                'Create a real-time chat app',
                'E-commerce store with payments',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  className="chat-suggestion"
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            {msg.role === 'user' && (
              <div className="chat-message-avatar user">
                <iconify-icon icon="solar:user-linear" width={14} />
              </div>
            )}
            {msg.role === 'assistant' && (
              <div className="chat-message-avatar assistant">
                <iconify-icon icon="solar:cpu-bolt-linear" width={14} />
              </div>
            )}
            <div className="chat-message-content">
              {msg.role === 'system' ? (
                <div className="chat-system-msg">{msg.content}</div>
              ) : (
                <div className="chat-text">{formatContent(msg.content)}</div>
              )}
              {msg.diagram && (
                <div className="chat-diagram-badge">
                  <iconify-icon icon="solar:graph-new-linear" width={12} />
                  Architecture updated
                </div>
              )}
              {msg.cost && (
                <div className="chat-cost-badge">
                  ~${((msg.cost.monthly || 0) / 100).toFixed(0)}/mo estimated
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamContent && (
          <div className="chat-message assistant">
            <div className="chat-message-avatar assistant">
              <iconify-icon icon="solar:cpu-bolt-linear" width={14} />
            </div>
            <div className="chat-message-content">
              <div className="chat-text">{formatContent(streamContent)}</div>
              <div className="chat-streaming-indicator animate-pulse">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamContent && (
          <div className="chat-message assistant">
            <div className="chat-message-avatar assistant">
              <iconify-icon icon="solar:cpu-bolt-linear" width={14} />
            </div>
            <div className="chat-message-content">
              <div className="chat-streaming-indicator animate-pulse">
                Thinking<span>.</span><span>.</span><span>.</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your architecture..."
          rows={1}
          disabled={isStreaming}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!input.trim() || isStreaming}
        >
          <iconify-icon icon="solar:arrow-up-linear" width={16} />
        </button>
      </form>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../../api/types';
import './ChatPanel.css';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamContent: string;
  onSend: (content: string, options?: { mode?: 'architecture' | 'code' | 'docs'; attachments?: File[]; mentions?: string[] }) => void;
  models: Array<{ id: string; name: string; provider: string }>;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  contextMode: 'architecture' | 'code' | 'docs';
  onContextModeChange: (mode: 'architecture' | 'code' | 'docs') => void;
  architecture?: { components: Array<{ id: string; name: string }> } | null;
}

type ContextMode = 'architecture' | 'code' | 'docs';

interface MentionOption {
  value: string;
  label: string;
  icon: string;
}

interface CommandOption {
  value: string;
  label: string;
  description: string;
  icon: string;
}

const CONTEXT_MODES: Array<{ mode: ContextMode; label: string; icon: string; placeholder: string }> = [
  { mode: 'architecture', label: 'Architecture', icon: 'solar:graph-new-linear', placeholder: 'Describe your architecture or ask to modify it...' },
  { mode: 'code', label: 'Code', icon: 'solar:code-linear', placeholder: 'Ask about code generation, review, or changes...' },
  { mode: 'docs', label: 'Docs', icon: 'solar:document-text-linear', placeholder: 'Ask about documentation, API specs, or guides...' },
];

const BASE_MENTIONS: MentionOption[] = [
  { value: '@architecture', label: '@architecture', icon: 'solar:graph-new-linear' },
  { value: '@code', label: '@code', icon: 'solar:code-linear' },
  { value: '@docs', label: '@docs', icon: 'solar:document-text-linear' },
];

const COMMANDS: CommandOption[] = [
  { value: '/generate', label: '/generate', description: 'Generate code from architecture', icon: 'solar:magic-stick-3-linear' },
  { value: '/preview', label: '/preview', description: 'Start local preview', icon: 'solar:play-linear' },
  { value: '/reset', label: '/reset', description: 'Reset conversation', icon: 'solar:restart-linear' },
  { value: '/layout', label: '/layout', description: 'Auto-layout architecture', icon: 'solar:tuning-2-linear' },
];

const ACCEPTED_FILE_TYPES = '.ts,.tsx,.js,.json,.md,.yaml,.yml,.sql,.png,.jpg,.jpeg,.gif,.webp,.svg';

function formatContent(content: string): string {
  return content
    .replace(/```mermaid[\s\S]*?```/g, '[Architecture Diagram]')
    .replace(/```[\s\S]*?```/g, (match) => match)
    .trim();
}

export default function ChatPanel({
  messages,
  isStreaming,
  streamContent,
  onSend,
  models,
  selectedModel,
  onModelChange,
  contextMode,
  onContextModeChange,
  architecture,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [commandQuery, setCommandQuery] = useState('');
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);
  const commandMenuRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }, [input]);

  // Click-away handler for dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setShowModelDropdown(false);
      }
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(target)) {
        setShowMentionMenu(false);
      }
      if (commandMenuRef.current && !commandMenuRef.current.contains(target)) {
        setShowCommandMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build mention options based on architecture components
  const mentionOptions = useCallback((): MentionOption[] => {
    const options = [...BASE_MENTIONS];
    if (architecture?.components) {
      for (const comp of architecture.components) {
        options.push({
          value: `@component:${comp.name}`,
          label: `@${comp.name}`,
          icon: 'solar:widget-linear',
        });
      }
    }
    return options;
  }, [architecture]);

  // Filter mention options by query
  const filteredMentions = mentionOptions().filter((opt) =>
    opt.label.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Filter commands by query
  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.value.toLowerCase().includes(commandQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(commandQuery.toLowerCase())
  );

  // Reset menu index when filtered list changes
  useEffect(() => {
    setMenuSelectedIndex(0);
  }, [mentionQuery, commandQuery]);

  // Detect @mentions and /commands in input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);
    if (mentionMatch) {
      setShowMentionMenu(true);
      setShowCommandMenu(false);
      setMentionQuery(mentionMatch[1]);
      setMenuSelectedIndex(0);
    } else {
      setShowMentionMenu(false);
      setMentionQuery('');
    }

    // Detect /command trigger (only at start of line)
    const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const lineBeforeCursor = textBeforeCursor.slice(lineStart);
    if (lineBeforeCursor.match(/^\/\S*$/) && lineBeforeCursor.length > 0) {
      setShowCommandMenu(true);
      setShowMentionMenu(false);
      setCommandQuery(lineBeforeCursor.slice(1));
      setMenuSelectedIndex(0);
    } else {
      setShowCommandMenu(false);
      setCommandQuery('');
    }
  };

  // Insert a mention into the textarea
  const insertMention = (mention: MentionOption) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
      const newValue = beforeMention + mention.value + ' ' + textAfterCursor;
      setInput(newValue);
      if (!mentions.includes(mention.value)) {
        setMentions([...mentions, mention.value]);
      }
    }

    setShowMentionMenu(false);
    setMentionQuery('');
    setTimeout(() => textarea.focus(), 0);
  };

  // Select a command
  const selectCommand = (command: CommandOption) => {
    setShowCommandMenu(false);
    setCommandQuery('');
    setInput('');
    onSend(command.value, { mode: contextMode, attachments: [], mentions: [] });
  };

  // Handle file attachment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeMention = (mention: string) => {
    setMentions((prev) => prev.filter((m) => m !== mention));
    // Also remove from input text
    setInput((prev) => prev.replace(mention, '').replace(/\s{2,}/g, ' ').trim());
  };

  // Submit handler
  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    onSend(input.trim(), {
      mode: contextMode,
      attachments: attachments.length > 0 ? attachments : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
    });
    setInput('');
    setAttachments([]);
    setMentions([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Keyboard navigation for menus + submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Menu navigation
    if (showMentionMenu && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuSelectedIndex((prev) => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuSelectedIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[menuSelectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (showCommandMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[menuSelectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandMenu(false);
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Group models by provider
  const modelsByProvider = models.reduce<Record<string, typeof models>>((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {});

  const selectedModelObj = models.find((m) => m.id === selectedModel);
  const currentPlaceholder = CONTEXT_MODES.find((m) => m.mode === contextMode)?.placeholder || 'Type a message...';

  // File size formatter
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  return (
    <div className="chat-panel">
      {/* Messages area */}
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
                    textareaRef.current?.focus();
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

      {/* Input area */}
      <div className="chat-input-area">
        {/* Context mode pills */}
        <div className="chat-context-pills">
          {CONTEXT_MODES.map(({ mode, label, icon }) => (
            <button
              key={mode}
              className={`chat-context-pill ${contextMode === mode ? 'active' : ''}`}
              onClick={() => onContextModeChange(mode)}
            >
              <iconify-icon icon={icon} width={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Main input container */}
        <div className="chat-input-container" ref={inputContainerRef}>
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="chat-attachment-chips">
              {attachments.map((file, i) => (
                <span key={i} className="chat-attachment-chip">
                  <iconify-icon
                    icon={file.type.startsWith('image/') ? 'solar:image-linear' : 'solar:file-text-linear'}
                    width={12}
                  />
                  <span className="chat-attachment-name">{file.name}</span>
                  <span className="chat-attachment-size">{formatFileSize(file.size)}</span>
                  <button
                    className="chat-attachment-remove"
                    onClick={() => removeAttachment(i)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <iconify-icon icon="solar:close-circle-linear" width={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Mention chips (shown above textarea when mentions exist) */}
          {mentions.length > 0 && (
            <div className="chat-mention-chips">
              {mentions.map((mention) => (
                <span key={mention} className="chat-mention-chip">
                  {mention}
                  <button
                    className="chat-mention-chip-remove"
                    onClick={() => removeMention(mention)}
                    aria-label={`Remove ${mention}`}
                  >
                    <iconify-icon icon="solar:close-circle-linear" width={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={currentPlaceholder}
            rows={1}
            disabled={isStreaming}
            className="chat-textarea"
          />

          {/* @mention autocomplete menu */}
          {showMentionMenu && filteredMentions.length > 0 && (
            <div className="chat-autocomplete-menu" ref={mentionMenuRef}>
              {filteredMentions.map((opt, i) => (
                <button
                  key={opt.value}
                  className={`chat-autocomplete-item ${i === menuSelectedIndex ? 'selected' : ''}`}
                  onClick={() => insertMention(opt)}
                  onMouseEnter={() => setMenuSelectedIndex(i)}
                >
                  <iconify-icon icon={opt.icon} width={14} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* /command autocomplete menu */}
          {showCommandMenu && filteredCommands.length > 0 && (
            <div className="chat-autocomplete-menu" ref={commandMenuRef}>
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.value}
                  className={`chat-autocomplete-item ${i === menuSelectedIndex ? 'selected' : ''}`}
                  onClick={() => selectCommand(cmd)}
                  onMouseEnter={() => setMenuSelectedIndex(i)}
                >
                  <iconify-icon icon={cmd.icon} width={14} />
                  <div className="chat-command-item-text">
                    <span className="chat-command-label">{cmd.label}</span>
                    <span className="chat-command-desc">{cmd.description}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="chat-toolbar">
            {/* Attach file button */}
            <button
              className="chat-toolbar-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              disabled={isStreaming}
            >
              <iconify-icon icon="solar:add-circle-linear" width={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileSelect}
              className="chat-file-input-hidden"
            />

            {/* Model selector */}
            <div className="chat-model-selector-wrapper" ref={modelDropdownRef}>
              <button
                className="chat-model-selector"
                onClick={() => setShowModelDropdown((prev) => !prev)}
                disabled={isStreaming}
              >
                <iconify-icon icon="solar:cpu-bolt-linear" width={12} />
                <span className="chat-model-name">{selectedModelObj?.name || selectedModel}</span>
                <iconify-icon
                  icon="solar:alt-arrow-down-linear"
                  width={12}
                  style={{ transform: showModelDropdown ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
                />
              </button>

              {showModelDropdown && (
                <div className="chat-model-dropdown">
                  {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                    <div key={provider} className="chat-model-group">
                      <div className="chat-model-group-label">{provider}</div>
                      {providerModels.map((model) => (
                        <button
                          key={model.id}
                          className={`chat-model-option ${model.id === selectedModel ? 'selected' : ''}`}
                          onClick={() => {
                            onModelChange(model.id);
                            setShowModelDropdown(false);
                          }}
                        >
                          <span>{model.name}</span>
                          {model.id === selectedModel && (
                            <iconify-icon icon="solar:check-circle-bold" width={14} style={{ color: 'var(--accent)' }} />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              className="chat-send-btn"
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
              title="Send message"
            >
              <iconify-icon icon="solar:arrow-up-linear" width={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

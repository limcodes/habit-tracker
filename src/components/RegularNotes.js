import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';

function RegularNotes({ 
  notes,
  displayedDays,
  editingNoteId,
  selectedNoteDate,
  setSelectedNoteDate,
  editNoteText,
  setEditNoteText,
  saveEditNote,
  cancelEditNote,
  startEditNote,
  deleteNote,
  toggleStickyNote,
  updateNoteCheckbox,
  parseNoteText
}) {
  const textareaRef = useRef(null);
  const noteTextRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const exitFullscreen = useCallback(() => setIsFullscreen(false), []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) exitFullscreen();
    };
    if (isFullscreen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, exitFullscreen]);

  // Auto-resize textarea to match content
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, 20)}px`;
    }
  };

  // Auto-resize when editing starts, content changes, or exiting fullscreen
  useEffect(() => {
    if (editingNoteId && textareaRef.current) {
      autoResizeTextarea();
    }
  }, [editingNoteId, editNoteText, isFullscreen]);

  // Handle checkbox toggle in view mode
  useEffect(() => {
    const handleCheckboxChange = (e) => {
      if (e.target.classList.contains('todo-checkbox')) {
        e.stopPropagation(); // Prevent event bubbling
        
        const lineIndex = parseInt(e.target.getAttribute('data-line'));
        const noteElement = e.target.closest('[data-note-id]');
        const noteId = noteElement?.getAttribute('data-note-id');
        
        if (noteId) {
          const note = notes.find(n => n.id === noteId);
          if (note) {
            const lines = note.text.split('\n');
            if (lines[lineIndex] !== undefined) {
              // Toggle checkbox state
              if (e.target.checked) {
                lines[lineIndex] = lines[lineIndex].replace(/^\[\]\s+/, '[x] ');
              } else {
                lines[lineIndex] = lines[lineIndex].replace(/^\[x\]\s+/i, '[] ');
              }
              
              // Update the note directly without entering edit mode
              const updatedText = lines.join('\n');
              updateNoteCheckbox(noteId, updatedText);
            }
          }
        }
      }
    };

    const handleCheckboxClick = (e) => {
      if (e.target.classList.contains('todo-checkbox') || e.target.closest('.todo-item')) {
        e.stopPropagation(); // Prevent double-click edit from triggering
      }
    };

    const noteContainer = noteTextRef.current;
    if (noteContainer) {
      noteContainer.addEventListener('change', handleCheckboxChange);
      noteContainer.addEventListener('click', handleCheckboxClick, true);
      noteContainer.addEventListener('dblclick', handleCheckboxClick, true);
      return () => {
        noteContainer.removeEventListener('change', handleCheckboxChange);
        noteContainer.removeEventListener('click', handleCheckboxClick, true);
        noteContainer.removeEventListener('dblclick', handleCheckboxClick, true);
      };
    }
  }, [notes, updateNoteCheckbox]);

  // Filter notes to only show those within the displayed period
  const filterNotesByPeriod = (notes) => {
    if (!displayedDays || displayedDays.length === 0) return notes.filter(note => !note.isSticky);
    
    const periodDateStrings = displayedDays.map(day => format(day, 'yyyy-MM-dd'));
    
    return notes.filter(note => 
      !note.isSticky && periodDateStrings.includes(note.date)
    );
  };

  return (
    <div className="notes-list" ref={noteTextRef}>
      {/* Regular Notes */}
      {filterNotesByPeriod(notes).map((note) => (
        <div key={note.id} className="note-item regular-note" data-note-id={note.id}>
          {editingNoteId === note.id ? (
            <div className={`note-edit ${isFullscreen ? 'fullscreen-overlay' : ''}`}>
              <div className="note-header">
                <span className="note-date">{note.date}</span>
                <div className="note-edit-actions">
                  <button 
                    className="save-note-btn" 
                    onClick={saveEditNote}
                    title="Save"
                  >✓</button>
                  <button 
                    className="cancel-note-btn" 
                    onClick={() => { setIsFullscreen(false); cancelEditNote(); }}
                    title="Cancel"
                  >✕</button>
                </div>
              </div>
              <div className="textarea-wrapper">
                <textarea
                  ref={textareaRef}
                  className="note-text-edit"
                  value={editNoteText}
                  onChange={(e) => {
                    setEditNoteText(e.target.value);
                    autoResizeTextarea();
                  }}
                  rows="1"
                  autoFocus
                />
                <button
                  className="fullscreen-toggle-btn"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                >{isFullscreen ? '✕' : '⛶'}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="note-header">
                <span className="note-date">{note.date}</span>
                <div className="note-actions hover-actions">
                  <button 
                    className="delete-note-btn" 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
                        deleteNote(note.id);
                      }
                    }}
                  >🗑️</button>
                  <button 
                    className="sticky-note-btn" 
                    onClick={() => toggleStickyNote(note.id)}
                  >{note.isSticky ? '📌' : '📍'}</button>
                </div>
              </div>
              <p 
                className="note-text"
                onDoubleClick={() => startEditNote(note)}
                dangerouslySetInnerHTML={{ __html: parseNoteText(note.text) }}
              ></p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default RegularNotes;

import React, { useEffect, useRef } from 'react';
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
  parseNoteText
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea to match content
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, 20)}px`;
    }
  };

  // Auto-resize when editing starts or content changes
  useEffect(() => {
    if (editingNoteId && textareaRef.current) {
      autoResizeTextarea();
    }
  }, [editingNoteId, editNoteText]);

  // Filter notes to only show those within the displayed period
  const filterNotesByPeriod = (notes) => {
    if (!displayedDays || displayedDays.length === 0) return notes.filter(note => !note.isSticky);
    
    const periodDateStrings = displayedDays.map(day => format(day, 'yyyy-MM-dd'));
    
    return notes.filter(note => 
      !note.isSticky && periodDateStrings.includes(note.date)
    );
  };

  return (
    <div className="notes-list">
      {/* Regular Notes */}
      {filterNotesByPeriod(notes).map((note) => (
        <div key={note.id} className="note-item regular-note">
          {editingNoteId === note.id ? (
            <div className="note-edit">
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
                    onClick={cancelEditNote}
                    title="Cancel"
                  >✕</button>
                </div>
              </div>
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

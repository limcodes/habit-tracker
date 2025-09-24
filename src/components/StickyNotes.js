import React, { useEffect, useRef } from 'react';

function StickyNotes({ 
  notes,
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

  return (
    <div className="sticky-notes-section">
      {/* Sticky Notes */}
      {notes.filter(note => note.isSticky).map((note) => (
        <div key={note.id} className="note-item sticky-note">
          {editingNoteId === note.id ? (
            <div className="note-edit">
              <div className="note-header">
                <input
                  type="date"
                  className="note-date-edit"
                  value={selectedNoteDate}
                  readOnly
                />
                <div className="note-edit-actions">
                  <button onClick={saveEditNote}>Save</button>
                  <button onClick={cancelEditNote}>Cancel</button>
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
                    className="edit-note-btn" 
                    onClick={() => startEditNote(note)}
                  >✎</button>
                  <button 
                    className="delete-note-btn" 
                    onClick={() => deleteNote(note.id)}
                  >✕</button>
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

export default StickyNotes;

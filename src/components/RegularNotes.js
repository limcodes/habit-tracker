import React from 'react';

function RegularNotes({ 
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
  return (
    <div className="notes-list">
      {/* Regular Notes */}
      {notes.filter(note => !note.isSticky).map((note) => (
        <div key={note.id} className="note-item regular-note">
          {editingNoteId === note.id ? (
            <div className="note-edit">
              <input
                type="date"
                value={selectedNoteDate}
                onChange={(e) => setSelectedNoteDate(e.target.value)}
              />
              <textarea
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value)}
                rows="3"
              />
              <div className="note-edit-actions">
                <button onClick={saveEditNote}>Save</button>
                <button onClick={cancelEditNote}>Cancel</button>
              </div>
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

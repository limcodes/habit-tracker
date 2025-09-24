import React from 'react';
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

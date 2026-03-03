import React, { useState, useEffect, useCallback } from 'react';

function AddNotes({ selectedNoteDate, setSelectedNoteDate, newNote, setNewNote, addNote }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const exitFullscreen = useCallback(() => setIsFullscreen(false), []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) exitFullscreen();
    };
    if (isFullscreen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, exitFullscreen]);

  return (
    <div className={`notes-input ${isFullscreen ? 'fullscreen-overlay' : ''}`}>
      <div className="textarea-wrapper">
        <div className="note-header">
          <input
            className="note-date-input"
            type="date"
            value={selectedNoteDate}
            onChange={(e) => setSelectedNoteDate(e.target.value)}
          />
        </div>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write your daily log here... Use **bold**, __underline__, *italic*, or ~~strikethrough~~"
          rows={isFullscreen ? undefined : "3"}
        />
        <button
          className="fullscreen-toggle-btn"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
        >{isFullscreen ? '✕' : '⛶'}</button>
      </div>
      <button onClick={addNote}>Add Log</button>
    </div>
  );
}

export default AddNotes;

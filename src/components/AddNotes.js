import React from 'react';

function AddNotes({ selectedNoteDate, setSelectedNoteDate, newNote, setNewNote, addNote }) {
  return (
    <div className="notes-input">
      <input
        type="date"
        value={selectedNoteDate}
        onChange={(e) => setSelectedNoteDate(e.target.value)}
      />
      <textarea
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
        placeholder="Write your daily log here... Use **bold**, __underline__, *italic*, or ~~strikethrough~~"
        rows="3"
      />
      <button onClick={addNote}>Add Log</button>
    </div>
  );
}

export default AddNotes;

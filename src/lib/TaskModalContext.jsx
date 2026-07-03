import React, { createContext, useContext, useState } from 'react';

const TaskModalContext = createContext(null);

export function TaskModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <TaskModalContext.Provider value={{ open, openTaskModal: () => setOpen(true), closeTaskModal: () => setOpen(false) }}>
      {children}
    </TaskModalContext.Provider>
  );
}

export function useTaskModal() {
  return useContext(TaskModalContext);
}
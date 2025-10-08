
export const getWeekDays = (weekOffset: number = 0) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    days.push(date);
  }
  return days;
};

export const formatDate = (date: Date, format: 'short' | 'long' = 'short') => {
  if (format === 'long') {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const getWeekDateRange = (weekOffset: number = 0) => {
  const weekDays = getWeekDays(weekOffset);
  const firstDay = weekDays[0];
  const lastDay = weekDays[6];
  
  if (firstDay.getMonth() === lastDay.getMonth()) {
    return `${firstDay.toLocaleDateString('en-US', { month: 'long' })} ${firstDay.getDate()} - ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
  } else {
    return `${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${firstDay.getFullYear()}`;
  }
};

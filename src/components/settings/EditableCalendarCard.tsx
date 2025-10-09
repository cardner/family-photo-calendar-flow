
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit2, Save, X, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { ICalCalendar } from '@/types/ical';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

const CALENDAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

interface EditData {
  name: string;
  url: string;
  color: string;
  syncFrequencyPerDay?: number;
}

interface EditableCalendarCardProps {
  calendar: ICalCalendar;
  isSelected: boolean;
  syncStatus: string;
  onUpdate: (id: string, updates: Partial<ICalCalendar>) => void;
  onSync: (calendar: ICalCalendar) => void;
  onRemove: (calendar: ICalCalendar) => void;
  onToggleSelection: (id: string, checked: boolean) => void;
}

const EditableCalendarCard = ({
  calendar,
  isSelected,
  syncStatus,
  onUpdate,
  onSync,
  onRemove,
  onToggleSelection
}: EditableCalendarCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<EditData>({
    name: calendar.name,
    url: calendar.url,
	color: calendar.color,
	syncFrequencyPerDay: calendar.syncFrequencyPerDay || 0
  });
  const ORIGINAL_REF = useRef(calendar);
  const draftKey = `calendar_edit_draft_${calendar.id}`;

  useEffect(() => {
    ORIGINAL_REF.current = calendar;
    if (isEditing) {
      return;
    }
    setEditData({
      name: calendar.name,
      url: calendar.url,
	color: calendar.color,
	syncFrequencyPerDay: calendar.syncFrequencyPerDay || 0
    });
  }, [calendar, isEditing]);

  // Load draft on mount (auto-enter editing if draft present)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as EditData;
        // Basic validation: ensure URL or name differs before applying
        const differs = draft.url !== calendar.url || draft.name !== calendar.name || draft.color !== calendar.color || draft.syncFrequencyPerDay !== calendar.syncFrequencyPerDay;
        if (differs) {
          setEditData(draft);
          setIsEditing(true);
        } else {
          // Cleanup stale identical draft
          localStorage.removeItem(draftKey);
        }
      }
    } catch (e) {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar.id]);

  // Persist draft while editing
  useEffect(() => {
    if (!isEditing) return;
    const original = ORIGINAL_REF.current;
    const changed = editData.name !== original.name || editData.url !== original.url || editData.color !== original.color || (editData.syncFrequencyPerDay || 0) !== (original.syncFrequencyPerDay || 0);
    if (changed) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(editData));
      } catch (e) {
        // ignore persistence errors
      }
    } else {
      // If user reverted back to original values, remove draft
      localStorage.removeItem(draftKey);
    }
  }, [editData, isEditing, draftKey]);

  const handleSave = () => {
    onUpdate(calendar.id, editData);
      setIsEditing(false);
    try { localStorage.removeItem(draftKey); } catch (e) { /* ignore remove draft errors */ }
    };

  const handleCancel = () => {
      setEditData({
        name: calendar.name,
        url: calendar.url,
    color: calendar.color,
    syncFrequencyPerDay: calendar.syncFrequencyPerDay || 0
      });
      setIsEditing(false);
    try { localStorage.removeItem(draftKey); } catch (e) { /* ignore remove draft errors */ }
    };

  const getSyncStatusBadge = () => {
    if (syncStatus === 'syncing') {
      return <Badge variant="secondary">Syncing...</Badge>;
    }
    if (syncStatus === 'error') {
      return <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white">Error</Badge>;
    }
    if (syncStatus === 'success' || calendar.lastSync) {
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">Synced</Badge>;
    }
    if (calendar.source === 'events') {
      return <Badge variant="outline">From Events</Badge>;
    }
    return <Badge variant="secondary">Not synced</Badge>;
  };

  const hasValidUrl = calendar.url && calendar.url.trim() !== '';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1">
          <div 
            className="w-4 h-4 rounded-full border cursor-pointer" 
            style={{
              backgroundColor: isEditing ? editData.color : calendar.color
            }} 
            onClick={() => isEditing && setIsEditing(true)} 
          />
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <Input 
                  value={editData.name} 
                  onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))} 
                  className="font-medium" 
                  placeholder="Calendar name" 
                />
                <Input 
                  value={editData.url} 
                  onChange={e => setEditData(prev => ({ ...prev, url: e.target.value }))} 
                  className="text-sm" 
                  placeholder="Calendar URL" 
                />
                <div className="flex gap-1">
                  {CALENDAR_COLORS.map(color => (
                    <button 
                      key={color} 
                      className={`w-6 h-6 rounded-full border-2 ${editData.color === color ? 'border-gray-900 dark:border-gray-100' : 'border-gray-300 dark:border-gray-600'}`} 
                      style={{ backgroundColor: color }} 
                      onClick={() => setEditData(prev => ({ ...prev, color }))} 
                    />
                  ))}
                </div>
                <div className="mt-3">
                  <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 block">Auto Sync (per day)</label>
                  <Select
                    value={String(editData.syncFrequencyPerDay || 0)}
                    onValueChange={(val) => setEditData(prev => ({ ...prev, syncFrequencyPerDay: Number(val) }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="Manual only" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Manual only</SelectItem>
                      <SelectItem value="1">1 / day</SelectItem>
                      <SelectItem value="2">2 / day (every 12h)</SelectItem>
                      <SelectItem value="4">4 / day (every 6h)</SelectItem>
                      <SelectItem value="6">6 / day (every 4h)</SelectItem>
                      <SelectItem value="8">8 / day (every 3h)</SelectItem>
                      <SelectItem value="12">12 / day (every 2h)</SelectItem>
                      <SelectItem value="24">24 / day (hourly)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {calendar.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {hasValidUrl ? (calendar.url.length > 50 ? `${calendar.url.substring(0, 50)}...` : calendar.url) : 'No URL available'}
                </p>
                {calendar.lastSync && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Last synced: {new Date(calendar.lastSync).toLocaleString()}
                    {calendar.eventCount !== undefined && ` • ${calendar.eventCount} events`}
                    {typeof calendar.syncFrequencyPerDay === 'number' && calendar.syncFrequencyPerDay > 0 && (
                      <> • Auto: {calendar.syncFrequencyPerDay}/day</>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getSyncStatusBadge()}
          
          {calendar.source === 'config' && (
            <Switch 
              checked={calendar.enabled} 
              onCheckedChange={(enabled) => onUpdate(calendar.id, { enabled })} 
              className="bg-gray-200 hover:bg-gray-100 dark:bg-zinc-300 dark:hover:bg-zinc-200" 
            />
          )}
          
          {isEditing ? (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleSave} 
                className="text-green-600 hover:text-green-700 border-green-300 hover:border-green-400 bg-gray-100 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:border-green-600 dark:hover:border-green-500 dark:bg-gray-800 dark:hover:bg-green-900/20"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleCancel} 
                className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 bg-gray-100 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:border-red-600 dark:hover:border-red-500 dark:bg-gray-800 dark:hover:bg-red-900/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsEditing(true)} 
              className="text-gray-500 hover:text-gray-700 border-gray-300 hover:border-gray-400 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:hover:text-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:bg-gray-800 dark:hover:bg-gray-700/50"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onSync(calendar)} 
            disabled={!hasValidUrl} 
            title={hasValidUrl ? "Sync this calendar" : "No URL available for syncing"} 
            className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400 bg-gray-100 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:border-blue-600 dark:hover:border-blue-500 dark:bg-gray-800 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onRemove(calendar)} 
            title="Remove this calendar" 
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 bg-gray-100 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:border-red-600 dark:hover:border-red-500 dark:bg-gray-800 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox 
              id={`calendar-selection-${calendar.id}`} 
              checked={isSelected} 
              onCheckedChange={checked => onToggleSelection(calendar.id, checked === true)} 
            />
            <label htmlFor={`calendar-selection-${calendar.id}`} className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Show in calendar view
            </label>
          </div>
          
          {calendar.hasEvents && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
              {calendar.eventCount || 0} event{(calendar.eventCount || 0) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditableCalendarCard;

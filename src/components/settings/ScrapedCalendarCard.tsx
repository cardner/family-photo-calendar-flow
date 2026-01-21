
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, RefreshCw, Calendar, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export interface ScrapedCalendarData {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  eventCount: number;
  lastSync?: string;
  type: 'notion-scraped';
  syncFrequencyPerDay?: number;
  connectionMode?: 'api' | 'public';
}

interface ScrapedCalendarCardProps {
  calendar: ScrapedCalendarData;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
  isSyncing?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string, selected: boolean) => void;
  onUpdateFrequency?: (id: string, freq: number) => void;
}

const ScrapedCalendarCard = ({ 
  calendar, 
  onToggle, 
  onDelete, 
  onSync, 
  isSyncing = false,
  isSelected = false,
  onToggleSelection,
  onUpdateFrequency
}: ScrapedCalendarCardProps) => {
  const handleToggle = (checked: boolean) => {
    onToggle(calendar.id, checked);
  };

  const handleDelete = () => {
    onDelete(calendar.id);
  };

  const handleSync = () => {
    onSync(calendar.id);
  };

  const handleVisibilityToggle = (checked: boolean) => {
    if (onToggleSelection) {
      onToggleSelection(calendar.id, checked);
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';
    
    try {
      const date = new Date(lastSync);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffHours > 24) {
        return date.toLocaleDateString();
      } else if (diffHours > 0) {
        return `${diffHours}h ago`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes}m ago`;
      } else {
        return 'Just now';
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {calendar.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={calendar.enabled ? "default" : "secondary"}>
              {calendar.enabled ? 'Active' : 'Disabled'}
            </Badge>
            {calendar.connectionMode && (
              <Badge variant="outline">
                {calendar.connectionMode === 'api' ? 'API' : 'Public'}
              </Badge>
            )}
            <Badge variant="outline">
              {calendar.eventCount} events
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sync Control */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Enable Sync
            </label>
            <p className="text-xs text-gray-500">
              Automatically sync events from this Notion database
            </p>
          </div>
          <Switch
            checked={calendar.enabled}
            onCheckedChange={handleToggle}
            disabled={isSyncing}
          />
        </div>

        {/* URL Display */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Notion URL</label>
          <p className="text-xs text-gray-600 break-all bg-gray-50 p-2 rounded">
            {calendar.url}
          </p>
        </div>

        {/* Last Sync Info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Last sync: {formatLastSync(calendar.lastSync)}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={isSyncing || !calendar.enabled}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Auto Sync Frequency */}
        <div className="space-y-1">
          <label className="text-sm font-medium flex items-center gap-2">
            Auto Sync (per day)
            {calendar.syncFrequencyPerDay ? (
              <Badge variant="secondary">{calendar.syncFrequencyPerDay}/day</Badge>
            ) : (
              <Badge variant="outline">Manual</Badge>
            )}
          </label>
          <select
            value={calendar.syncFrequencyPerDay || 0}
            onChange={e => onUpdateFrequency && onUpdateFrequency(calendar.id, Number(e.target.value))}
            className="w-full h-8 rounded border border-gray-300 bg-white text-xs px-2"
            disabled={!calendar.enabled}
          >
            <option value={0}>Manual only</option>
            <option value={1}>1 / day</option>
            <option value={2}>2 / day (12h)</option>
            <option value={4}>4 / day (6h)</option>
            <option value={6}>6 / day (4h)</option>
            <option value={8}>8 / day (3h)</option>
            <option value={12}>12 / day (2h)</option>
            <option value={24}>24 / day (hourly)</option>
          </select>
        </div>
      </CardContent>

      {/* Visibility Control Footer */}
      {onToggleSelection && (
        <CardFooter className="bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <Checkbox
                id={`visibility-${calendar.id}`}
                checked={isSelected}
                onCheckedChange={handleVisibilityToggle}
                disabled={!calendar.enabled}
              />
              <div className="flex items-center gap-2">
                {isSelected ? (
                  <Eye className="h-4 w-4 text-green-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                )}
                <label 
                  htmlFor={`visibility-${calendar.id}`} 
                  className="text-sm font-medium cursor-pointer"
                >
                  Show in calendar view
                </label>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default ScrapedCalendarCard;

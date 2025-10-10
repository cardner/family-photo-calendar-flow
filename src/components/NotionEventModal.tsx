import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Calendar, Clock, MapPin, ExternalLink, Tag, Flag, AlertCircle, ChevronDown, ChevronRight, Database } from 'lucide-react';
import { NotionScrapedEvent } from '@/services/NotionPageScraper';
import { formatNotionProperty, extractIngredientsFromArray, extractNotesFromArray } from '@/utils/notionPropertyFormatter';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

interface NotionEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: NotionScrapedEvent | null;
}

const NotionEventModal = ({ open, onOpenChange, event }: NotionEventModalProps) => {
  const [isDatabasePropsOpen, setIsDatabasePropsOpen] = useState(false);
  
  if (!event) return null;

  const handleOpenInNotion = () => {
    if (event.sourceUrl) {
      window.open(event.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time?: string) => {
    if (!time) return 'All day';
    return time;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'tentative':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 break-words">
                {event.title}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(event.date)}</span>
                <Clock className="h-4 w-4 ml-2" />
                <span>{formatTime(event.time)}</span>
              </div>
            </div>
            {event.sourceUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNotion}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Notion
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <SettingsSectionCard
            heading={(
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Event Overview
              </span>
            )}
            description="Key details synced from your Notion page"
            contentClassName="space-y-5"
          >
            {/* Status and Priority */}
            <div className="flex flex-wrap gap-2">
              {event.status && (
                <Badge className={getStatusColor(event.status)}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {event.status}
                </Badge>
              )}
              {event.priority && (
                <Badge className={getPriorityColor(event.priority)}>
                  <Flag className="h-3 w-3 mr-1" />
                  {event.priority} Priority
                </Badge>
              )}
            </div>

            {/* Location */}
            {event.location && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </h3>
                <p className="text-gray-700 dark:text-gray-300">{event.location}</p>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Description</h3>
                <div className="text-gray-700 dark:text-gray-300 space-y-3">
                  {event.description.split('\n').map((section, index) => {
                    // Check if this section contains ingredients (bulleted list)
                    if (section.toLowerCase().includes('ingredients:')) {
                      const ingredientMatch = section.match(/ingredients:\s*(.*)/i);
                      if (ingredientMatch) {
                        const ingredients = ingredientMatch[1].split(',').map(item => item.trim()).filter(Boolean);
                        return (
                          <div key={index} className="space-y-2">
                            <p className="font-medium">Ingredients:</p>
                            <ul className="list-disc pl-6 space-y-1">
                              {ingredients.map((ingredient, i) => (
                                <li key={i}>{ingredient}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                    }
                    
                    // Check if this section contains notes with potential links
                    if (section.toLowerCase().includes('notes:')) {
                      const noteMatch = section.match(/notes:\s*(.*)/i);
                      if (noteMatch) {
                        const noteContent = noteMatch[1];
                        // Simple URL detection
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const parts = noteContent.split(urlRegex);
                        
                        return (
                          <div key={index} className="space-y-2">
                            <p className="font-medium">Notes:</p>
                            <div className="space-y-1">
                              {parts.map((part, i) => {
                                if (urlRegex.test(part)) {
                                  return (
                                    <a 
                                      key={i} 
                                      href={part} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200"
                                    >
                                      {part}
                                    </a>
                                  );
                                }
                                return <span key={i}>{part}</span>;
                              })}
                            </div>
                          </div>
                        );
                      }
                    }
                    
                    // Regular text sections
                    return section.trim() ? (
                      <p key={index} className="whitespace-pre-wrap">{section}</p>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Categories */}
            {event.categories && event.categories.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Categories
                </h3>
                <div className="flex flex-wrap gap-2">
                  {event.categories.map((category, index) => (
                    <Badge key={index} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            {event.dateRange && event.dateRange.endDate && (
              <div className="space-y-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Duration</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {formatDate(event.dateRange.startDate)} - {formatDate(event.dateRange.endDate)}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last synced: {event.scrapedAt.toLocaleString()}
              </p>
            </div>
          </SettingsSectionCard>

          {/* Database Properties */}
          {event.properties && Object.keys(event.properties).length > 0 && (
            <Collapsible open={isDatabasePropsOpen} onOpenChange={setIsDatabasePropsOpen}>
              <SettingsSectionCard
                heading={(
                  <span className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Properties
                  </span>
                )}
                description={`${Object.keys(event.properties).length} properties available`}
                actions={(
                  <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    {isDatabasePropsOpen ? (
                      <>
                        <ChevronDown className="h-3 w-3" /> Hide
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3" /> Show
                      </>
                    )}
                  </CollapsibleTrigger>
                )}
                contentClassName="space-y-4"
              >
                <CollapsibleContent className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                  {Object.entries(event.properties).map(([key, propertyValue]) => {
                    const property = propertyValue as unknown;
                    const keyLower = key.toLowerCase();

                    // Special handling for ingredients
                    if (keyLower.includes('ingredient') && (property as { type?: string }).type === 'array') {
                      const ingredients = extractIngredientsFromArray(property as Parameters<typeof extractIngredientsFromArray>[0]);
                      if (ingredients.length === 0) return null;

                      return (
                        <div key={key} className="space-y-2">
                          <span className="font-medium text-gray-600 dark:text-gray-400 capitalize block">
                            {key}:
                          </span>
                          <div className="text-gray-800 dark:text-gray-200">
                            <ul className="list-disc pl-6 space-y-1">
                              {ingredients.map((ingredient, index) => (
                                <li key={index}>{ingredient}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );
                    }

                    // Special handling for notes
                    if (keyLower.includes('note') && (property as { type?: string }).type === 'array') {
                      const notes = extractNotesFromArray(property as Parameters<typeof extractNotesFromArray>[0]);
                      if (notes.length === 0) return null;

                      return (
                        <div key={key} className="space-y-2">
                          <span className="font-medium text-gray-600 dark:text-gray-400 capitalize block">
                            {key}:
                          </span>
                          <div className="text-gray-800 dark:text-gray-200 space-y-2">
                            {notes.map((note, index) => {
                              if (note.type === 'url') {
                                return (
                                  <a
                                    key={index}
                                    href={note.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200 block"
                                  >
                                    {note.content}
                                  </a>
                                );
                              }
                              return (
                                <p key={index}>{note.content}</p>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Regular property formatting
                    const value = formatNotionProperty(property as Parameters<typeof formatNotionProperty>[0]);
                    if (!value) return null;

                    return (
                      <div key={key} className="flex justify-between items-start gap-4 py-1">
                        <span className="font-medium text-gray-600 dark:text-gray-400 capitalize">
                          {key}:
                        </span>
                        <span className="text-gray-800 dark:text-gray-200 text-right max-w-xs break-words">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </SettingsSectionCard>
            </Collapsible>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotionEventModal;
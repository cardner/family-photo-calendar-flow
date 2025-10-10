import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import { Loader2, TestTube, Bug, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface NotionUrlFormProps {
  onSubmit: (data: { name: string; url: string; color: string; token: string; databaseId: string }) => Promise<void>;
  onCancel: () => void;
  validateUrl: (url: string, token?: string) => Promise<{ isValid: boolean; error?: string }>;
  showDebugButton?: boolean;
  onDebugPreview?: (url: string, token?: string) => void;
}

const CALENDAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export const NotionUrlForm: React.FC<NotionUrlFormProps> = ({
  onSubmit,
  onCancel,
  validateUrl,
  showDebugButton = false,
  onDebugPreview
}) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    token: '',
    color: CALENDAR_COLORS[0]
  });
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ValidationResult tracks connection test status (no database object stored yet)
  interface ValidationResult {
    status: 'idle' | 'success' | 'error';
    error?: string;
  }
  const [validationResult, setValidationResult] = useState<ValidationResult>({ status: 'idle' });

  const extractDatabaseIdFromUrl = (url: string): string | null => {
    const patterns = [
      /notion\.so\/([a-f0-9]{32})/,
      /notion\.so\/.*-([a-f0-9]{32})/,
      /notion\.so\/.*\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1].replace(/-/g, '');
      }
    }
    return null;
  };

  const handleValidate = async () => {
    if (!formData.url.trim()) {
      setValidationResult({ status: 'error', error: 'Please enter a Notion database URL' });
      return;
    }

    if (!formData.token.trim()) {
      setValidationResult({ status: 'error', error: 'Please enter a Notion integration token' });
      return;
    }

    setIsValidating(true);
    setValidationResult({ status: 'idle' });

    try {
      const result = await validateUrl(formData.url, formData.token);
      
      if (result.isValid) {
        setValidationResult({ status: 'success' });
        
        // Auto-generate name if not provided
        if (!formData.name.trim()) {
          const databaseId = extractDatabaseIdFromUrl(formData.url);
          setFormData(prev => ({ 
            ...prev, 
            name: `Notion Database ${databaseId?.slice(-8) || 'Calendar'}` 
          }));
        }
      } else {
        setValidationResult({ status: 'error', error: result.error });
      }
    } catch (error) {
      setValidationResult({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Validation failed' 
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (validationResult.status !== 'success') {
      await handleValidate();
      return;
    }

    if (!formData.name.trim()) {
      setValidationResult({ status: 'error', error: 'Please enter a calendar name' });
      return;
    }

    setIsSubmitting(true);

    try {
      const databaseId = extractDatabaseIdFromUrl(formData.url);
      if (!databaseId) {
        throw new Error('Could not extract database ID from URL');
      }

      await onSubmit({
        name: formData.name,
        url: formData.url,
        color: formData.color,
        token: formData.token,
        databaseId
      });
    } catch (error) {
      setValidationResult({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to add calendar' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDebugPreview = () => {
    if (onDebugPreview) {
      onDebugPreview(formData.url, formData.token);
    }
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <InfoBanner variant="info">
        <InfoBannerIcon>
          <ExternalLink className="h-5 w-5" />
        </InfoBannerIcon>
        <InfoBannerContent>
          <InfoBannerTitle variant="info">Before adding your database</InfoBannerTitle>
          <InfoBannerDescription variant="info" className="space-y-2 text-sm">
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Create an integration at{' '}
                <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  notion.so/my-integrations
                </a>
              </li>
              <li>Copy the integration token (starts with "ntn_")</li>
              <li>Share your database with the integration</li>
              <li>Copy the database URL from your browser</li>
            </ol>
          </InfoBannerDescription>
        </InfoBannerContent>
      </InfoBanner>

      {/* Integration Token */}
      <div>
        <Label htmlFor="token">Notion Integration Token</Label>
        <Input
          id="token"
          type="password"
          placeholder="ntn_..."
          value={formData.token}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, token: e.target.value }));
            setValidationResult({ status: 'idle' });
          }}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Get your integration token from <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Notion Integrations</a>
        </p>
      </div>

      {/* Database URL */}
      <div>
        <Label htmlFor="url">Notion Database URL</Label>
        <Input
          id="url"
          type="url"
          placeholder="https://notion.so/your-database-url"
          value={formData.url}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, url: e.target.value }));
            setValidationResult({ status: 'idle' });
          }}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Copy the full URL from your browser when viewing the database
        </p>
      </div>

      {/* Validation Button */}
      <Button
        onClick={handleValidate}
        disabled={isValidating || !formData.url.trim() || !formData.token.trim()}
        variant="outline"
        className="w-full"
      >
        {isValidating ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <TestTube className="h-4 w-4 mr-2" />
        )}
        Test Connection
      </Button>

      {/* Validation Result */}
      {validationResult.status === 'success' && (
        <InfoBanner variant="success">
          <InfoBannerIcon>
            <CheckCircle className="h-5 w-5" />
          </InfoBannerIcon>
          <InfoBannerContent>
            <InfoBannerTitle variant="success">Connection successful</InfoBannerTitle>
            <InfoBannerDescription variant="success">
              Database is accessible and ready to sync.
            </InfoBannerDescription>
          </InfoBannerContent>
        </InfoBanner>
      )}

      {validationResult.status === 'error' && (
        <InfoBanner variant="destructive">
          <InfoBannerIcon>
            <AlertCircle className="h-5 w-5" />
          </InfoBannerIcon>
          <InfoBannerContent>
            <InfoBannerTitle variant="destructive">Connection failed</InfoBannerTitle>
            <InfoBannerDescription variant="destructive">
              {validationResult.error}
            </InfoBannerDescription>
          </InfoBannerContent>
        </InfoBanner>
      )}

      {/* Calendar Configuration - only show after successful validation */}
      {validationResult.status === 'success' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Calendar Name */}
            <div>
              <Label htmlFor="name">Calendar Name</Label>
              <Input
                id="name"
                placeholder="My Notion Calendar"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* Color Picker */}
            <div>
              <Label>Calendar Color</Label>
              <div className="flex gap-2 mt-2">
                {CALENDAR_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          {showDebugButton && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDebugPreview}
              disabled={!formData.url.trim() || !formData.token.trim()}
            >
              <Bug className="h-4 w-4 mr-2" />
              Debug Preview
            </Button>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || validationResult.status !== 'success' || !formData.name.trim()}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Add Calendar
          </Button>
        </div>
      </div>
    </div>
  );
};

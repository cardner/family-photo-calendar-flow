import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings/SettingsContext';
import { Loader2, CheckCircle, AlertCircle, TestTube, Shield, Users, Database, ExternalLink } from 'lucide-react';
import { notionService } from '@/services/notionService';

interface NotionIntegrationFormProps {
  onIntegrationComplete?: (token: string, databaseId: string) => void;
}

// Added minimal types to replace any
interface IntegrationInfo {
  name?: string;
  type?: string;
  workspace?: { name?: string };
}

interface TestedDatabaseInfo {
  database?: { title?: { plain_text?: string }[] };
  properties?: Record<string, { id: string; name: string; type: string }>;
  samplePages?: unknown[];
}

const NotionIntegrationForm = ({ onIntegrationComplete }: NotionIntegrationFormProps) => {
  const { notionToken, setNotionToken, notionDatabaseId, setNotionDatabaseId } = useSettings();
  const { toast } = useToast();
  
  const [tokenInput, setTokenInput] = useState('');
  const [databaseIdInput, setDatabaseIdInput] = useState('');
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [isTestingDatabase, setIsTestingDatabase] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [tokenValidation, setTokenValidation] = useState<{
    status: 'idle' | 'success' | 'error';
    error?: string;
    integrationInfo?: IntegrationInfo;
  }>({ status: 'idle' });
  
  const [databaseValidation, setDatabaseValidation] = useState<{
    status: 'idle' | 'success' | 'error';
    error?: string;
    databaseInfo?: TestedDatabaseInfo;
  }>({ status: 'idle' });

  // Initialize form with existing values
  useEffect(() => {
    if (notionToken) {
      setTokenInput(notionToken);
      setTokenValidation({ status: 'success' });
    }
    if (notionDatabaseId) {
      setDatabaseIdInput(notionDatabaseId);
      setDatabaseValidation({ status: 'success' });
    }
  }, [notionToken, notionDatabaseId]);

  const validateTokenFormat = (token: string): { valid: boolean; error?: string } => {
    if (!token.trim()) {
      return { valid: false, error: 'Token cannot be empty' };
    }
    
    if (!token.startsWith('ntn_')) {
      return { valid: false, error: 'Notion integration tokens must start with "ntn_"' };
    }
    
    if (token.length < 50) {
      return { valid: false, error: 'Token appears to be too short. Notion tokens are typically 50+ characters' };
    }
    
    return { valid: true };
  };

  const validateDatabaseIdFormat = (input: string): { valid: boolean; error?: string } => {
    if (!input.trim()) {
      return { valid: false, error: 'Database ID cannot be empty' };
    }

    const validation = notionService.validateDatabaseId(input);
    if (!validation.isValid) {
      return { valid: false, error: 'Please enter a valid database ID (32 hex characters) or Notion share URL' };
    }

    return { valid: true };
  };

  const handleTestToken = async () => {
    const formatValidation = validateTokenFormat(tokenInput);
    if (!formatValidation.valid) {
      setTokenValidation({ status: 'error', error: formatValidation.error });
      return;
    }

    setIsTestingToken(true);
    setTokenValidation({ status: 'idle' });

    try {
      const isValid = await notionService.validateToken(tokenInput);
      
      if (isValid) {
        const info = await notionService.getIntegrationInfo(tokenInput);
        setTokenValidation({ 
          status: 'success', 
          integrationInfo: info
        });
        
        toast({
          title: "Token validation successful",
          description: `Connected to ${info.workspace?.name || 'Notion workspace'} as ${info.name}`,
        });
      } else {
        setTokenValidation({ 
          status: 'error', 
          error: 'Token validation failed. Please check the token and try again.' 
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      setTokenValidation({ status: 'error', error: errorMessage });
      
      toast({
        title: "Token validation failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsTestingToken(false);
    }
  };

  const handleTestDatabase = async () => {
    if (tokenValidation.status !== 'success') {
      toast({
        title: "Token required",
        description: "Please validate your integration token first",
        variant: "destructive"
      });
      return;
    }

    const formatValidation = validateDatabaseIdFormat(databaseIdInput);
    if (!formatValidation.valid) {
      setDatabaseValidation({ status: 'error', error: formatValidation.error });
      return;
    }

    setIsTestingDatabase(true);
    setDatabaseValidation({ status: 'idle' });

    try {
      const validation = notionService.validateDatabaseId(databaseIdInput);
      const result = await notionService.testDatabaseAccess(validation.id, tokenInput);
      
      if (result.success) {
        setDatabaseValidation({ 
          status: 'success', 
          databaseInfo: result
        });
        
        toast({
          title: "Database access successful",
          description: `Connected to database: ${result.database?.title?.[0]?.plain_text || 'Untitled Database'}`,
        });
      } else {
        setDatabaseValidation({ 
          status: 'error', 
          error: result.error || 'Database access failed' 
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      setDatabaseValidation({ status: 'error', error: errorMessage });
      
      toast({
        title: "Database test failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsTestingDatabase(false);
    }
  };

  const handleSaveIntegration = async () => {
    if (tokenValidation.status !== 'success' || databaseValidation.status !== 'success') {
      toast({
        title: "Validation required",
        description: "Please test both the token and database access before saving",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      const validation = notionService.validateDatabaseId(databaseIdInput);
      
      setNotionToken(tokenInput);
      setNotionDatabaseId(validation.id);
      
      toast({
        title: "Integration saved successfully",
        description: "Notion integration has been configured and saved securely."
      });

      if (onIntegrationComplete) {
        onIntegrationComplete(tokenInput, validation.id);
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save integration settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigured = notionToken && notionDatabaseId;
  const canSave = tokenValidation.status === 'success' && databaseValidation.status === 'success';

  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Database className="h-5 w-5" />
          Notion Integration Setup
          {isConfigured && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Configured
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Configure your Notion integration token and database for importing calendar events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Instructions */}
        <InfoBanner variant="info">
          <InfoBannerIcon>
            <Shield className="h-5 w-5" />
          </InfoBannerIcon>
          <InfoBannerContent>
            <InfoBannerTitle variant="info">Setup required</InfoBannerTitle>
            <InfoBannerDescription variant="info" className="space-y-2 text-sm">
              <p>To connect Notion, you'll need:</p>
              <div className="space-y-1">
                <p>
                  1. Create an internal integration at{' '}
                  <Button variant="link" className="p-0 h-auto text-blue-600 dark:text-blue-400" asChild>
                    <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer">
                      Notion Integrations <ExternalLink className="h-3 w-3 ml-1 inline" />
                    </a>
                  </Button>
                </p>
                <p>2. Copy the integration token (starts with "ntn_")</p>
                <p>3. Share your database with the integration</p>
                <p>4. Get the database ID from the database URL</p>
              </div>
            </InfoBannerDescription>
          </InfoBannerContent>
        </InfoBanner>

        {/* Token Input */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="notion-token" className="text-gray-700 dark:text-gray-300">Integration Token</Label>
            <Input
              id="notion-token"
              type="password"
              placeholder="ntn_..."
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setTokenValidation({ status: 'idle' });
              }}
              className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
            {tokenValidation.status === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{tokenValidation.error}</p>
            )}
          </div>
          
          <Button 
            onClick={handleTestToken}
            disabled={isTestingToken || !tokenInput.trim()}
            variant="outline"
            className="w-full border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            {isTestingToken ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Test Integration Token
          </Button>

          {tokenValidation.status === 'success' && tokenValidation.integrationInfo && (
            <InfoBanner variant="success">
              <InfoBannerIcon>
                <CheckCircle className="h-5 w-5" />
              </InfoBannerIcon>
              <InfoBannerContent>
                <InfoBannerTitle variant="success">Integration connected</InfoBannerTitle>
                <InfoBannerDescription variant="success" className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {tokenValidation.integrationInfo.name}</p>
                  {tokenValidation.integrationInfo.workspace && (
                    <p><strong>Workspace:</strong> {tokenValidation.integrationInfo.workspace.name}</p>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>Type: {tokenValidation.integrationInfo.type}</span>
                  </div>
                </InfoBannerDescription>
              </InfoBannerContent>
            </InfoBanner>
          )}
        </div>

        {/* Database ID Input - only show after token validation */}
        {tokenValidation.status === 'success' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="database-id" className="text-gray-700 dark:text-gray-300">
                Database ID or Share URL
              </Label>
              <Input
                id="database-id"
                placeholder="9fc8a972a9a6489f91f9e71d7443189d or https://notion.so/..."
                value={databaseIdInput}
                onChange={(e) => {
                  setDatabaseIdInput(e.target.value);
                  setDatabaseValidation({ status: 'idle' });
                }}
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
              {databaseValidation.status === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{databaseValidation.error}</p>
              )}
            </div>
            
            <Button 
              onClick={handleTestDatabase}
              disabled={isTestingDatabase || !databaseIdInput.trim()}
              variant="outline"
              className="w-full border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              {isTestingDatabase ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Test Database Access
            </Button>

            {databaseValidation.status === 'success' && databaseValidation.databaseInfo && (
              <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-200">Database Connected</span>
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p><strong>Name:</strong> {databaseValidation.databaseInfo.database?.title?.[0]?.plain_text || 'Untitled Database'}</p>
                  <p><strong>Properties:</strong> {Object.keys(databaseValidation.databaseInfo.properties || {}).length}</p>
                  <p><strong>Sample Pages:</strong> {databaseValidation.databaseInfo.samplePages?.length || 0}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        {canSave && (
          <Button 
            onClick={handleSaveIntegration}
            disabled={isSaving}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save Integration
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default NotionIntegrationForm;

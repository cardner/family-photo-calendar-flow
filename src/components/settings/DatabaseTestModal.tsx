
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, Database, Eye, Hash } from 'lucide-react';
import { notionService } from '@/services/notionService';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DatabaseTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onConfirm: (databaseId: string, databaseName: string) => void;
}

const DatabaseTestModal = ({ open, onOpenChange, token, onConfirm }: DatabaseTestModalProps) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  const validateInput = (value: string) => {
    const result = notionService.validateDatabaseId(value);
    setValidationResult(result);
    return result;
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    setTestResult(null);
    if (value.trim()) {
      validateInput(value);
    } else {
      setValidationResult(null);
    }
  };

  const testDatabase = async () => {
    if (!validationResult?.isValid) return;

    setIsLoading(true);
    try {
      const result = await notionService.testDatabaseAccess(validationResult.id, token);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (testResult?.success && testResult.database) {
      const databaseName = testResult.database.title?.[0]?.plain_text || 'Untitled Database';
      onConfirm(validationResult.id, databaseName);
      onOpenChange(false);
      // Reset state
      setInput('');
      setTestResult(null);
      setValidationResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Database className="h-5 w-5" />
            Test Database Access
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Test access to a Notion database by entering its ID or share URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input Section */}
          <div>
            <Label htmlFor="database-input" className="text-gray-700 dark:text-gray-300">
              Database ID or Share URL
            </Label>
            <Input
              id="database-input"
              placeholder="9fc8a972a9a6489f91f9e71d7443189d or https://notion.so/..."
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
            
            {/* Validation Feedback */}
            {validationResult && (
              <div className="mt-2">
                {validationResult.isValid ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Valid {validationResult.type === 'id' ? 'database ID' : 'Notion URL'} detected
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    Please enter a valid database ID (32 hex characters) or Notion share URL
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Button */}
          <Button
            onClick={testDatabase}
            disabled={!validationResult?.isValid || isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Test Database Access
          </Button>

          {/* Results Section */}
          {testResult && (
            <div className="space-y-4">
              {testResult.success ? (
                <div className="space-y-4">
                  {/* Success Message */}
                  <Alert className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      Successfully connected to database! You can now add this to your calendars.
                    </AlertDescription>
                  </Alert>

                  {/* Database Info */}
                  <Card className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-900 dark:text-gray-100">Database Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {testResult.database?.title?.[0]?.plain_text || 'Untitled Database'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">ID</div>
                        <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          {validationResult.id}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Properties</div>
                        <div className="flex flex-wrap gap-1">
                          {testResult.properties && Object.entries(testResult.properties).map(([key, prop]: [string, any]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {prop.name} ({prop.type})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {testResult.samplePages?.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Sample Pages ({testResult.samplePages.length})
                          </div>
                          <div className="space-y-1">
                            {testResult.samplePages.slice(0, 3).map((page: any, index: number) => (
                              <div key={index} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                • {page.properties?.Name?.title?.[0]?.plain_text || 
                                   page.properties?.Title?.title?.[0]?.plain_text || 
                                   'Untitled'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Alert className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    <div className="font-medium">Database access failed</div>
                    <div className="text-sm mt-1">{testResult.error}</div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setInput('');
                setTestResult(null);
                setValidationResult(null);
              }}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            {testResult?.success && (
              <Button
                onClick={handleConfirm}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Add Database
              </Button>
            )}
          </div>

          {/* Help Section */}
          <Alert className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <Hash className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
              <div className="font-medium mb-1">How to find your database ID:</div>
              <div className="space-y-1 text-xs">
                <div>• <strong>From URL:</strong> Copy the share URL from Notion</div>
                <div>• <strong>Direct ID:</strong> Find the 32-character hex string in the URL</div>
                <div>• <strong>Must share:</strong> Ensure the database is shared with your integration</div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DatabaseTestModal;

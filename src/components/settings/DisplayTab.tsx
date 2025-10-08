
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Moon, Sun, Monitor } from 'lucide-react';

interface DisplayTabProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  defaultView: 'month' | 'timeline' | 'week';
  onDefaultViewChange: (view: 'month' | 'timeline' | 'week') => void;
  keepScreenAwake: boolean;
  onKeepScreenAwakeChange: (enabled: boolean) => void;
}

const DisplayTab = ({ theme, onThemeChange, defaultView, onDefaultViewChange, keepScreenAwake, onKeepScreenAwakeChange }: DisplayTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Theme</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Choose your preferred theme for the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={onThemeChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="light" className="border-gray-400 dark:border-gray-500 text-blue-600 dark:text-blue-400" />
              <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                <Sun className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                Light
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dark" id="dark" className="border-gray-400 dark:border-gray-500 text-blue-600 dark:text-blue-400" />
              <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                <Moon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Dark
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="system" id="system" className="border-gray-400 dark:border-gray-500 text-blue-600 dark:text-blue-400" />
              <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                <Monitor className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                System
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Default Calendar View</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Choose your preferred default view for the calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={defaultView} onValueChange={onDefaultViewChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="month" id="month" className="border-gray-400 dark:border-gray-500 text-blue-600 dark:text-blue-400" />
              <Label htmlFor="month" className="cursor-pointer text-gray-700 dark:text-gray-300">
                Month View
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="timeline" id="timeline" className="border-gray-400 dark:border-gray-500 text-blue-600 dark:text-blue-400" />
              <Label htmlFor="timeline" className="cursor-pointer text-gray-700 dark:text-gray-300">
                Timeline View
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="week" id="week" className="border-gray-400 dark:border-gray-500 text-blue-600 dark:text-blue-400" />
              <Label htmlFor="week" className="cursor-pointer text-gray-700 dark:text-gray-300">
                Week View
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Screen Wake Lock</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Prevent the screen from turning off or going to sleep while the app is visible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Keep Screen Awake
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Useful for presentations or when viewing the calendar for extended periods
              </p>
            </div>
            <Button
              variant={keepScreenAwake ? "default" : "outline"}
              size="sm"
              onClick={() => onKeepScreenAwakeChange(!keepScreenAwake)}
              className="ml-4"
            >
              {keepScreenAwake ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DisplayTab;

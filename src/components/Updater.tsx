import { useEffect, useState } from 'react';
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';
import { relaunch } from '@tauri-apps/api/process';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

export const Updater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdates = async () => {
    try {
      const { shouldUpdate, manifest } = await checkUpdate();
      
      if (shouldUpdate) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: manifest?.version || 'new version',
          body: manifest?.body || 'A new version is available'
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      await installUpdate();
      await relaunch();
    } catch (error) {
      console.error('Failed to install update:', error);
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    checkForUpdates();
    // Check for updates every hour
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Dialog open={updateAvailable} onOpenChange={setUpdateAvailable}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Available</DialogTitle>
          <DialogDescription>
            Version {updateInfo?.version} is available for download.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-500">{updateInfo?.body}</p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setUpdateAvailable(false)}
            disabled={isUpdating}
          >
            Later
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Install Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 
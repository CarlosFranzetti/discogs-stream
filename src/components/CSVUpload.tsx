import { Upload, FileText, Loader2, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRef } from 'react';

interface CSVUploadProps {
  onCollectionUpload: (file: File) => Promise<void>;
  onWantlistUpload: (file: File) => Promise<void>;
  onClear?: () => void;
  isLoading: boolean;
  error: string | null;
  collectionCount: number;
  wantlistCount: number;
}

export function CSVUpload({
  onCollectionUpload,
  onWantlistUpload,
  onClear,
  isLoading,
  error,
  collectionCount,
  wantlistCount,
}: CSVUploadProps) {
  const collectionInputRef = useRef<HTMLInputElement>(null);
  const wantlistInputRef = useRef<HTMLInputElement>(null);

  const handleCollectionChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onCollectionUpload(file);
      // Reset input
      if (collectionInputRef.current) {
        collectionInputRef.current.value = '';
      }
    }
  };

  const handleWantlistChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onWantlistUpload(file);
      // Reset input
      if (wantlistInputRef.current) {
        wantlistInputRef.current.value = '';
      }
    }
  };

  const hasData = collectionCount > 0 || wantlistCount > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Load from CSV Files
            </CardTitle>
            <CardDescription className="mt-1.5">
              Upload your Discogs collection and/or wantlist CSV exports
            </CardDescription>
          </div>
          {hasData && onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {hasData && (
          <Alert>
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              Loaded {collectionCount} collection {collectionCount === 1 ? 'item' : 'items'}
              {wantlistCount > 0 && ` and ${wantlistCount} wantlist ${wantlistCount === 1 ? 'item' : 'items'}`}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div>
            <input
              ref={collectionInputRef}
              type="file"
              accept=".csv"
              onChange={handleCollectionChange}
              className="hidden"
              id="collection-csv-upload"
              disabled={isLoading}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => collectionInputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Collection CSV
            </Button>
          </div>

          <div>
            <input
              ref={wantlistInputRef}
              type="file"
              accept=".csv"
              onChange={handleWantlistChange}
              className="hidden"
              id="wantlist-csv-upload"
              disabled={isLoading}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => wantlistInputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Wantlist CSV
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
          <p className="font-medium">How to export from Discogs:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Go to your Discogs collection or wantlist</li>
            <li>Click the "..." menu and select "Export"</li>
            <li>Choose CSV format and download the file</li>
            <li>Upload the file here</li>
          </ol>
          <p className="italic mt-2">
            Note: CSV files don't include album artwork. YouTube videos will be resolved automatically when playing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

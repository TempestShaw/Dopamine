import { useState } from 'react';
import { activityService } from '@/app/services/activityService';

export default function DownloadSection() {
    const [customUrl, setCustomUrl] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState('');

    const handleUrlCheck = async () => {
        setIsChecking(true);
        setError('');
        try {
            const url = customUrl.startsWith('http') ? customUrl : `http://${customUrl}`;
            const response = await activityService.healthCheck(url);
            if (!response) {
                setError('Could not connect to Dopamine');
            }
        } catch (error) {
            console.error('URL Check failed:', error);
            setError('Invalid URL format ');
        }
        setIsChecking(false);
    };

    return(
        <div className="p-4 flex flex-col gap-2">
            <a 
                href="https://github.com/TempestShaw/Dopamine/releases/latest" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-primary py-4 mb-4 bg-base-300 w-64 border-none"
            >
                Download for Windows
            </a>
            <h1 className="text-slate-800">Already have Dopamine installed?</h1>
            <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center gap-2">
                    <p>Enter URL:</p>
                    <input 
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="http://localhost:26535"
                        className="input input-bordered w-64 border-2 border-base-200"
                    />
                </div>
                <button 
                    onClick={handleUrlCheck}
                    disabled={isChecking || !customUrl}
                    className="btn btn-secondary w-24"
                >
                    {isChecking ? 'Checking...' : 'Connect'}
                </button>
                {error && <p className="text-error text-sm">{error}</p>}
            </div>
        </div>
    );
}
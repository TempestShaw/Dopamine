'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { activityService } from '@/app/services/activityService';

export default function Login() {
    const [pinCode, setPinCode] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const success = await activityService.verifyPinCode(pinCode);
            if (success) {
                router.push('/');
            }
        } catch (error) {
            setError('Invalid pin code');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-300">
            <div className="p-8 bg-base-100 rounded-lg shadow-lg w-96">
                <h1 className="text-2xl text-base-content font-bold mb-6 text-center">Enter Pin Code</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value)}
                            placeholder="Enter pin code"
                            className="input w-full bg-base-200 text-base-content"
                            maxLength={6}
                        />
                    </div>
                    {error && (
                        <div className="text-error text-sm text-center">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={!pinCode}
                    >
                        Verify
                    </button>
                </form>
            </div>
        </div>
    );
}
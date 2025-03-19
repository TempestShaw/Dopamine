import { activityService } from "@/app/services/activityService";
import router from "next/router";
import { useState } from "react";

export default function PairingSession() {
    const [pinCode, setPinCode] = useState('');
    const [error, setError] = useState('');
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const success = await activityService.verifyPinCode(pinCode);
            if (success) {
                router.push('/');
            }
        //@ts-ignore  
        } catch (err) {
            setError('Invalid pin code');
        }
    };
    return(
    <div className="p-8 px-4 bg-base-200 rounded-lg shadow-lg">
    <h1 className="text-xl text-base-content font-bold mb-6">Enter your pairing Code</h1>
    <form onSubmit={handleSubmit} className="space-x-4 flex flex-row">
        <div>
            <input
                type="password"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Enter pin code"
                className="input w-48 bg-base-200 text-base-content"
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
            className="btn btn-primary w-16"
            disabled={!pinCode}
        >
            Verify
        </button>
    </form>
</div>
    )
}
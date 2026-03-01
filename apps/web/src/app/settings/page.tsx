'use client';

import { useState, useEffect } from 'react';
import {
  useProfile,
  useUpdateProfile,
  useIntegrations,
  useConnectIntegration,
  useDisconnectIntegration,
} from '@/hooks/use-settings';
import { ThemeSwitcher } from '@/components/theme-switcher';

export default function SettingsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: integrations, isLoading: integrationsLoading } = useIntegrations();
  const connectIntegration = useConnectIntegration();
  const disconnectIntegration = useDisconnectIntegration();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? '');
      setLastName(profile.last_name ?? '');
      setEmail(profile.email ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const handleSaveProfile = () => {
    updateProfile.mutate({
      firstName,
      lastName,
      email,
      phone,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account and platform settings</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          <p className="mt-1 text-sm text-gray-500">Your personal information</p>
          {profileLoading ? (
            <div className="mt-4 animate-pulse space-y-4">
              <div className="h-10 rounded bg-gray-100" />
              <div className="h-10 rounded bg-gray-100" />
              <div className="h-10 rounded bg-gray-100" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              {updateProfile.isSuccess && (
                <p className="text-sm text-green-600">Profile updated successfully.</p>
              )}
            </div>
          )}
        </div>

        {/* Integrations */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
          <p className="mt-1 text-sm text-gray-500">Connect external services</p>
          <div className="mt-4 space-y-3">
            {integrationsLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : (
              (integrations ?? []).map((integration) => (
                <div key={integration.provider} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{integration.name}</p>
                    <p className="text-xs text-gray-500">
                      {integration.connected ? integration.status : 'Not connected'}
                      {integration.accountEmail && ` - ${integration.accountEmail}`}
                    </p>
                  </div>
                  {integration.connected ? (
                    <button
                      onClick={() => disconnectIntegration.mutate(integration.provider)}
                      disabled={disconnectIntegration.isPending}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => connectIntegration.mutate(integration.provider)}
                      disabled={connectIntegration.isPending}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Connect
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Client Theme */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>
          <p className="mt-1 text-sm text-gray-500">Customize the interface theme</p>
          <div className="mt-4">
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}

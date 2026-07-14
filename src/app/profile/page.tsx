"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTxLine } from '../../context/TxLineContext';
import { useAutoSubscribe } from '../../hooks/useAutoSubscribe';
import { saveProfileImage, loadProfileImage } from '../../lib/persistence';
import { initProfile, updateProfile, fetchUserProfile, fetchUserEscrows } from '../../lib/settlement';
import { useTranslations } from 'next-intl';
import {
  PersonIcon,
  CameraIcon,
  ExternalLinkIcon,
  UpdateIcon,
  DotsHorizontalIcon,
  CheckCircledIcon,
  GlobeIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { PushToggle } from '../../components/PushToggle';
import { useNotifications } from '../../context/NotificationContext';

export default function ProfilePage() {
  const { publicKey, signTransaction, disconnect } = useWallet();
  const { connection } = useConnection();
  const { client } = useTxLine();
  const t = useTranslations('Profile');
  const { state: subState, subscribe } = useAutoSubscribe();
  const { notificationsEnabled, toggleNotifications, loadFromProfile } = useNotifications();
  const [balance, setBalance] = useState<number | null>(null);
  const [totalBets, setTotalBets] = useState(0);
  const [wonBets, setWonBets] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [profileExists, setProfileExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const walletStr = publicKey?.toBase58() || '';
  const shortWallet = walletStr ? `${walletStr.slice(0, 4)}...${walletStr.slice(-4)}` : '';

  const initials = walletStr
    ? walletStr.slice(0, 2).toUpperCase()
    : '?';

  useEffect(() => {
    if (!publicKey) return;
    connection.getBalance(publicKey).then(b => setBalance(b / 1e9)).catch(() => {});
    setProfileImg(loadProfileImage(publicKey.toBase58()));
    fetchUserProfile(connection, publicKey).then((p) => {
      if (p) {
        setProfileExists(true);
        const uri = p.account.image_uri || '';
        setImageUri(uri);
        setXHandle(p.account.x_handle || '');
        if (uri && !profileImg) {
          setProfileImg(uri);
        }
        if (p.account.notifications_enabled != null) {
          loadFromProfile(connection, publicKey);
        }
      }
    }).catch(() => {});
    fetchUserEscrows(connection, publicKey).then((data) => {
      setTotalBets(data.length);
      let won = 0;
      let total = 0;
      for (const { account } of data) {
        const stateKey = account.state ? Object.keys(account.state)[0] : null;
        if (stateKey === 'Settled' && account.depositor_won) {
          const amount = Number(account.amount || 0) / 1_000_000;
          const odds = account.odds ? Number(account.odds) / 1000 : 2.0;
          won++;
          total += amount * odds;
        }
      }
      setWonBets(won);
      setEarnings(total);
    }).catch(() => {});
  }, [publicKey, connection, loadFromProfile]);

  const handleImagePick = () => fileRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProfileImg(dataUrl);
      if (publicKey) saveProfileImage(publicKey.toBase58(), dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!publicKey || !signTransaction) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const sig = profileExists
        ? await updateProfile(connection, { publicKey, signTransaction }, imageUri, xHandle, notificationsEnabled)
        : await initProfile(connection, { publicKey, signTransaction }, imageUri, xHandle, notificationsEnabled);
      setProfileExists(true);
      setSaveMsg(t('savedOnSolana'));
    } catch (e: any) {
      setSaveMsg(`Error: ${e?.message?.slice(0, 60)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (publicKey) await client.clearForWallet(publicKey.toBase58());
    disconnect();
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full animate-float-slow"
          style={{
            width: 250,
            height: 250,
            top: '0%',
            right: '-15%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.03) 0%, transparent 70%)',
            animationDuration: '14s',
          }}
        />
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 180,
            height: 180,
            bottom: '10%',
            left: '-10%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.02) 0%, transparent 70%)',
            animationDuration: '11s',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Avatar section */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden cursor-pointer transition-all duration-300"
                style={{
                  background: profileImg ? 'var(--bg-elevated)' : 'rgba(245,158,11,0.12)',
                  border: `2px solid ${profileImg ? 'var(--border)' : 'rgba(245,158,11,0.25)'}`,
                  boxShadow: profileImg
                    ? '0 0 30px rgba(220,235,2,0.1)'
                    : '0 0 24px rgba(245,158,11,0.08)',
                }}
                onClick={handleImagePick}
              >
                {profileImg ? (
                  <img src={profileImg} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--warning)' }}>
                    {initials}
                  </span>
                )}
              </div>
            <button
              onClick={handleImagePick}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
              style={{
                background: 'var(--accent)',
                color: '#000',
                boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
              }}
            >
              <CameraIcon width={14} height={14} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <h1 className="text-lg font-bold tracking-tight mb-0.5">{shortWallet || t('notConnected')}</h1>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'rgba(245,158,11,0.1)',
              color: 'var(--warning)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            {t('solanaDevnet')}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { val: balance != null ? `${balance.toFixed(3)}` : '--', label: t('sol') },
            { val: totalBets.toString(), label: t('predictions') },
            { val: `${wonBets} (${earnings.toFixed(2)} USDT)`, label: t('won') },
          ].map((s, i) => (
            <div
              key={s.label}
              className="text-center rounded-2xl py-4 px-3 animate-slideUp"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(12px)',
                animationDelay: `${0.1 + i * 0.06}s`,
                animationFillMode: 'backwards',
              }}
            >
              <div
                className="text-lg font-extrabold tabular-nums mb-0.5"
                style={i === 0 ? { color: 'var(--accent)' } : {}}
              >
                {s.val}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {!publicKey ? (
          <div className="text-center py-16 animate-scaleIn">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <PersonIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('connectWallet')}</h2>
            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {t('needConnect')}
            </p>
          </div>
        ) : (
          <>
            {/* Info card */}
            <div
              className="rounded-2xl p-5 mb-6 space-y-4"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Wallet */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('wallet')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold">{shortWallet}</span>
                  <ExternalLinkIcon width={12} height={12} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Red */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('network')}</span>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: 'rgba(245,158,11,0.1)',
                    color: 'var(--warning)',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  {t('solanaDevnet')}
                </span>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* API TxLINE */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('apiTxline')}</span>
                <div className="flex items-center gap-2">
                  {subState === 'subscribing' || subState === 'activating' ? (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: 'var(--accent-dim)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(220,235,2,0.15)',
                      }}
                    >
                      <ReloadIcon width={10} height={10} className="animate-spin" />
                      {t('activating')}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: client.hasApiToken
                          ? 'rgba(34,197,94,0.08)'
                          : 'var(--bg-surface)',
                        color: client.hasApiToken ? 'var(--success)' : 'var(--text-muted)',
                        border: `1px solid ${
                          client.hasApiToken
                            ? 'rgba(34,197,94,0.2)'
                            : 'var(--border)'
                        }`,
                      }}
                    >
                      {client.hasApiToken ? t('active') : t('inactive')}
                    </span>
                  )}
                  {!client.hasApiToken && subState !== 'subscribing' && subState !== 'activating' && (
                    <button
                      onClick={subscribe}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-200 active:scale-95"
                      style={{ background: 'var(--accent)', color: '#000' }}
                    >
                      <GlobeIcon width={10} height={10} />
                      {t('activate')}
                    </button>
                  )}
                </div>
              </div>
              {subState === 'error' && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs animate-slideDown"
                  style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.12)' }}
                >
                  <span className="flex-1" style={{ color: 'var(--text-muted)' }}>
                    {t('activationError')}
                  </span>
                  <button
                    onClick={subscribe}
                    className="text-xs font-semibold px-3 py-1 rounded-full transition-all active:scale-95"
                    style={{ background: 'rgba(255,68,68,0.1)', color: 'var(--danger)' }}
                  >
                    {t('retry')}
                  </button>
                </div>
              )}

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Notificaciones Push */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('pushNotifications')}</span>
                <PushToggle wallet={publicKey?.toBase58()} />
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Notificaciones in-app */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Notificaciones in-app</span>
                <button
                  onClick={toggleNotifications}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 active:scale-95 ${!notificationsEnabled ? 'opacity-60' : ''}`}
                  style={{
                    background: notificationsEnabled ? 'rgba(34,197,94,0.08)' : 'var(--bg-surface)',
                    color: notificationsEnabled ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${notificationsEnabled ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                  }}
                >
                  {notificationsEnabled ? 'Activadas' : 'Desactivadas'}
                </button>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Image URI */}
              <div>
                <label className="text-[11px] font-medium mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  {t('imageUri')}
                </label>
                <div
                  className="flex items-center rounded-xl px-4"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <input
                    className="flex-1 bg-transparent py-2.5 text-sm outline-none"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="https://ejemplo.com/avatar.jpg"
                    value={imageUri}
                    onChange={(e) => setImageUri(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* X Handle */}
              <div>
                <label className="text-[11px] font-medium mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  {t('xHandle')}
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 flex items-center rounded-xl px-4"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>@</span>
                    <input
                      className="flex-1 bg-transparent py-2.5 text-sm outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      placeholder="usuario"
                      value={xHandle}
                      onChange={(e) => setXHandle(e.target.value)}
                    />
                  </div>
                  {xHandle && (
                    <a
                      href={`https://x.com/${xHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center shrink-0 rounded-xl transition-all duration-200 hover:opacity-70"
                      style={{
                        width: 42,
                        height: 42,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--accent)',
                      }}
                    >
                      <ExternalLinkIcon width={16} height={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Save message */}
            {saveMsg && (
              <div
                className={`flex items-center gap-2 text-xs p-3 rounded-xl mb-4 animate-scaleIn ${
                  saveMsg.startsWith('Error') ? '' : ''
                }`}
                style={{
                  background: saveMsg.startsWith('Error')
                    ? 'rgba(255,68,68,0.08)'
                    : 'rgba(34,197,94,0.06)',
                  border: `1px solid ${
                    saveMsg.startsWith('Error')
                      ? 'rgba(255,68,68,0.15)'
                      : 'rgba(34,197,94,0.15)'
                  }`,
                  color: saveMsg.startsWith('Error')
                    ? 'var(--danger)'
                    : 'var(--success)',
                }}
              >
                {saveMsg.startsWith('Error') ? (
                  <DotsHorizontalIcon width={14} height={14} />
                ) : (
                  <CheckCircledIcon width={14} height={14} />
                )}
                <span className="font-medium">{saveMsg}</span>
              </div>
            )}

            {/* Save button */}
            <button
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 mb-3"
              style={{
                background: 'var(--accent)',
                color: '#000',
                boxShadow: !saving ? '0 0 24px rgba(220,235,2,0.15)' : 'none',
              }}
              onClick={handleSave}
              disabled={saving || !publicKey}
            >
              {saving ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }}
                  />
                  {t('saving')}
                </>
              ) : (
                <>
                  <UpdateIcon width={18} height={18} />
                  {profileExists ? t('updateProfile') : t('saveProfile')}
                </>
              )}
            </button>

            {/* Disconnect button */}
            <button
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              onClick={handleDisconnect}
            >
              {t('disconnect')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

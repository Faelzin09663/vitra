import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthGate } from '../src/auth/AuthGate';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: { auth } }));
beforeEach(() => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});
afterEach(cleanup);
const app = () => render(<AuthGate>{u => <div>Dashboard {u.id}</div>}</AuthGate>);

describe('Autenticação', () => {
  it('envia nome, e-mail e senha ao Supabase e aguarda confirmação sem abrir o painel', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    app();
    fireEvent.click(await screen.findByText('Cadastre-se'));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Rafael Silva' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'rafael@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'example-password' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'example-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({ email: 'rafael@example.com', password: 'example-password', options: { data: { full_name: 'Rafael Silva' }, emailRedirectTo: window.location.origin } }));
    await screen.findByText(/Confira seu e-mail/);
    expect(screen.queryByText(/Dashboard/)).toBeNull();
    expect(localStorage.getItem('vitra')).toBeNull();
  });
  it('não envia cadastro com confirmação de senha diferente', async () => {
    app(); fireEvent.click(await screen.findByText('Cadastre-se'));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Rafael' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'rafael@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'password-one' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'password-two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'As senhas precisam ser iguais.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it('mostra erro de credenciais sem abrir o painel', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });
    app(); await screen.findByText('Que bom ter você aqui.');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'rafael@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'E-mail ou senha incorretos.');
    expect(screen.queryByText(/Dashboard/)).toBeNull();
  });
  it('restaura uma sessão existente', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-a' } } }, error: null });
    app(); expect(await screen.findByText('Dashboard owner-a')).toBeTruthy();
  });
  it('envia recuperação de senha com retorno para o app', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    app(); fireEvent.click(await screen.findByText('Esqueci minha senha'));
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'rafael@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));
    await screen.findByText(/Se este e-mail estiver cadastrado/);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('rafael@example.com', { redirectTo: window.location.origin });
  });
});

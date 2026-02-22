import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock useAuth
const mockLogin = vi.fn();
const mockClearAuthExpiredMessage = vi.fn();
let mockIsAuthenticated = false;
let mockAuthExpiredMessage: string | null = null;

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        login: mockLogin,
        isAuthenticated: mockIsAuthenticated,
        authExpiredMessage: mockAuthExpiredMessage,
        clearAuthExpiredMessage: mockClearAuthExpiredMessage,
    }),
}));

const renderLoginPage = () => {
    return render(
        <MemoryRouter>
            <LoginPage />
        </MemoryRouter>,
    );
};

describe('LoginPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsAuthenticated = false;
        mockAuthExpiredMessage = null;
    });

    describe('前端元素', () => {
        it('應正確渲染登入頁面標題與表單元素', () => {
            renderLoginPage();

            expect(screen.getByText('歡迎回來')).toBeInTheDocument();
            expect(screen.getByText('請登入以繼續')).toBeInTheDocument();
            expect(screen.getByLabelText('電子郵件')).toBeInTheDocument();
            expect(screen.getByLabelText('密碼')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '登入' })).toBeInTheDocument();
        });

        it('當 VITE_API_URL 未設定時，應顯示測試帳號提示文字', () => {
            renderLoginPage();

            expect(
                screen.getByText('測試帳號：任意 email 格式 / 密碼需包含英數且8位以上'),
            ).toBeInTheDocument();
        });
    });

    describe('表單驗證', () => {
        it('輸入無效的 Email 格式時，應顯示 Email 錯誤訊息', async () => {
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'abc');
            await user.type(screen.getByLabelText('密碼'), 'password1');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('請輸入有效的 Email 格式')).toBeInTheDocument();
        });

        it('輸入少於 8 個字元的密碼時，應顯示密碼長度錯誤訊息', async () => {
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'test@test.com');
            await user.type(screen.getByLabelText('密碼'), 'abc1');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('密碼必須至少 8 個字元')).toBeInTheDocument();
        });

        it('輸入不含英文字母或數字的密碼時，應顯示密碼格式錯誤訊息', async () => {
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'test@test.com');
            await user.type(screen.getByLabelText('密碼'), '12345678');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('密碼必須包含英文字母和數字')).toBeInTheDocument();
        });

        it('同時輸入無效 Email 與無效密碼時，應同時顯示兩個錯誤訊息', async () => {
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'abc');
            await user.type(screen.getByLabelText('密碼'), '123');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('請輸入有效的 Email 格式')).toBeInTheDocument();
            expect(screen.getByText('密碼必須至少 8 個字元')).toBeInTheDocument();
        });
    });

    describe('Mock API', () => {
        it('登入成功時，應導向 /dashboard', async () => {
            mockLogin.mockResolvedValueOnce(undefined);
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'test@test.com');
            await user.type(screen.getByLabelText('密碼'), 'password1');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password1');
                expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
            });
        });

        it('登入失敗時（API 回傳錯誤），應顯示 API 錯誤訊息', async () => {
            mockLogin.mockRejectedValueOnce({
                response: { data: { message: '密碼錯誤' } },
            });
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'test@test.com');
            await user.type(screen.getByLabelText('密碼'), 'password1');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(screen.getByText('密碼錯誤')).toBeInTheDocument();
            });
        });

        it('登入過程中，按鈕應顯示 loading 狀態且表單欄位應被禁用', async () => {
            // Make login hang to observe loading state
            mockLogin.mockImplementationOnce(
                () => new Promise((resolve) => setTimeout(resolve, 5000)),
            );
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'test@test.com');
            await user.type(screen.getByLabelText('密碼'), 'password1');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(screen.getByText('登入中...')).toBeInTheDocument();
                expect(screen.getByLabelText('電子郵件')).toBeDisabled();
                expect(screen.getByLabelText('密碼')).toBeDisabled();
                expect(screen.getByRole('button', { name: '登入中...' })).toBeDisabled();
            });
        });

        it('登入失敗後（API 回傳伺服器錯誤），應顯示預設錯誤訊息', async () => {
            mockLogin.mockRejectedValueOnce({
                response: { data: {} },
            });
            const user = userEvent.setup();
            renderLoginPage();

            await user.type(screen.getByLabelText('電子郵件'), 'test@test.com');
            await user.type(screen.getByLabelText('密碼'), 'password1');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(screen.getByText('登入失敗，請稍後再試')).toBeInTheDocument();
            });
        });
    });

    describe('路由導向', () => {
        it('已登入狀態下，應自動導向 /dashboard', () => {
            mockIsAuthenticated = true;
            renderLoginPage();

            expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
        });

        it('當 authExpiredMessage 存在時，應顯示過期訊息並清除', async () => {
            mockAuthExpiredMessage = '登入已過期，請重新登入';
            renderLoginPage();

            await waitFor(() => {
                expect(screen.getByText('登入已過期，請重新登入')).toBeInTheDocument();
                expect(mockClearAuthExpiredMessage).toHaveBeenCalled();
            });
        });
    });
});

export const validators = {
    email: (value: string): string | null => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) return "이메일을 입력해주세요";
        if (!emailRegex.test(value)) return "올바른 이메일 형식이 아닙니다";
        return null;
    },

    password: (value: string): string | null => {
        if (!value) return "비밀번호를 입력해주세요";
        if (value.length < 8) return "비밀번호는 8자 이상이어야 합니다";
        if (value.length > 72) return "비밀번호는 72자 이하여야 합니다";
        if (!/[a-zA-Z]/.test(value)) return "영문자를 1개 이상 포함해야 합니다";
        if (!/[0-9]/.test(value)) return "숫자를 1개 이상 포함해야 합니다";
        return null;
    },

    displayName: (value: string): string | null => {
        const trimmed = value.trim();
        if (!trimmed) return "닉네임을 입력해주세요";
        if (trimmed.length > 64) return "닉네임은 64자 이하여야 합니다";
        return null;
    },

    passwordConfirm: (password: string, confirm: string): string | null => {
        if (password !== confirm) return "비밀번호가 일치하지 않습니다";
        return null;
    },
};

using System.Runtime.InteropServices;
using System.Text;

namespace DopamineWin.Native;

/// <summary>
/// A minimal wrapper over the SQLite that ships with Windows 10 and later (winsqlite3.dll), so the
/// agent needs no SQLite library of its own. Not thread-safe; callers serialise access.
/// </summary>
internal sealed unsafe class Sqlite : IDisposable
{
    private const string Lib = "winsqlite3.dll";
    private const int SQLITE_OK = 0, SQLITE_ROW = 100, SQLITE_DONE = 101, SQLITE_NULL = 5;
    private const int OPEN_READWRITE = 0x2, OPEN_CREATE = 0x4, OPEN_FULLMUTEX = 0x10000;
    private static readonly IntPtr Transient = new(-1);

    [DllImport(Lib)] private static extern int sqlite3_open_v2(byte* filename, IntPtr* db, int flags, byte* vfs);
    [DllImport(Lib)] private static extern int sqlite3_close_v2(IntPtr db);
    [DllImport(Lib)] private static extern int sqlite3_exec(IntPtr db, byte* sql, IntPtr callback, IntPtr arg, byte** error);
    [DllImport(Lib)] private static extern void sqlite3_free(void* ptr);
    [DllImport(Lib)] private static extern char* sqlite3_errmsg16(IntPtr db);
    [DllImport(Lib)] internal static extern int sqlite3_prepare16_v2(IntPtr db, char* sql, int bytes, IntPtr* stmt, char** tail);
    [DllImport(Lib)] internal static extern int sqlite3_step(IntPtr stmt);
    [DllImport(Lib)] internal static extern int sqlite3_reset(IntPtr stmt);
    [DllImport(Lib)] internal static extern int sqlite3_clear_bindings(IntPtr stmt);
    [DllImport(Lib)] internal static extern int sqlite3_finalize(IntPtr stmt);
    [DllImport(Lib)] internal static extern int sqlite3_bind_int64(IntPtr stmt, int index, long value);
    [DllImport(Lib)] internal static extern int sqlite3_bind_text16(IntPtr stmt, int index, char* text, int bytes, IntPtr destructor);
    [DllImport(Lib)] internal static extern int sqlite3_bind_blob(IntPtr stmt, int index, void* data, int bytes, IntPtr destructor);
    [DllImport(Lib)] internal static extern int sqlite3_bind_null(IntPtr stmt, int index);
    [DllImport(Lib)] internal static extern long sqlite3_column_int64(IntPtr stmt, int col);
    [DllImport(Lib)] internal static extern char* sqlite3_column_text16(IntPtr stmt, int col);
    [DllImport(Lib)] internal static extern int sqlite3_column_bytes16(IntPtr stmt, int col);
    [DllImport(Lib)] internal static extern void* sqlite3_column_blob(IntPtr stmt, int col);
    [DllImport(Lib)] internal static extern int sqlite3_column_bytes(IntPtr stmt, int col);
    [DllImport(Lib)] internal static extern int sqlite3_column_type(IntPtr stmt, int col);

    private IntPtr _db;

    public Sqlite(string path)
    {
        var name = Encoding.UTF8.GetBytes(path + "\0");
        IntPtr db;
        fixed (byte* p = name)
        {
            if (sqlite3_open_v2(p, &db, OPEN_READWRITE | OPEN_CREATE | OPEN_FULLMUTEX, null) != SQLITE_OK)
            {
                var message = LastError(db);
                sqlite3_close_v2(db);
                throw new InvalidOperationException($"Could not open {path}: {message}");
            }
        }

        _db = db;
    }

    public void Execute(string sql)
    {
        var bytes = Encoding.UTF8.GetBytes(sql + "\0");
        byte* error = null;
        fixed (byte* p = bytes)
        {
            if (sqlite3_exec(_db, p, IntPtr.Zero, IntPtr.Zero, &error) != SQLITE_OK)
            {
                var message = error == null ? LastError(_db) : Marshal.PtrToStringUTF8((IntPtr)error);
                if (error != null) sqlite3_free(error);
                throw new InvalidOperationException($"SQL failed: {message}");
            }
        }
    }

    public Statement Prepare(string sql)
    {
        IntPtr stmt;
        fixed (char* p = sql)
        {
            if (sqlite3_prepare16_v2(_db, p, sql.Length * 2, &stmt, null) != SQLITE_OK)
                throw new InvalidOperationException($"Could not prepare statement: {LastError(_db)}");
        }

        return new Statement(stmt, this);
    }

    internal string LastError() => LastError(_db);

    private static string LastError(IntPtr db)
    {
        var message = db == IntPtr.Zero ? null : sqlite3_errmsg16(db);
        return message == null ? "unknown error" : new string(message);
    }

    public void Dispose()
    {
        if (_db == IntPtr.Zero) return;
        sqlite3_close_v2(_db);
        _db = IntPtr.Zero;
    }

    internal sealed class Statement : IDisposable
    {
        private IntPtr _stmt;
        private readonly Sqlite _owner;

        internal Statement(IntPtr stmt, Sqlite owner)
        {
            _stmt = stmt;
            _owner = owner;
        }

        public Statement Bind(int index, long value)
        {
            sqlite3_bind_int64(_stmt, index, value);
            return this;
        }

        public Statement Bind(int index, string? value)
        {
            if (value == null)
            {
                sqlite3_bind_null(_stmt, index);
                return this;
            }

            fixed (char* p = value)
                sqlite3_bind_text16(_stmt, index, p, value.Length * 2, Transient);
            return this;
        }

        public Statement Bind(int index, byte[]? value)
        {
            if (value == null)
            {
                sqlite3_bind_null(_stmt, index);
                return this;
            }

            fixed (byte* p = value)
                sqlite3_bind_blob(_stmt, index, p, value.Length, Transient);
            return this;
        }

        /// <summary>Advances to the next row; false once the statement is done.</summary>
        public bool Step()
        {
            var rc = sqlite3_step(_stmt);
            if (rc == SQLITE_ROW) return true;
            if (rc == SQLITE_DONE) return false;
            throw new InvalidOperationException($"SQL step failed: {_owner.LastError()}");
        }

        /// <summary>Runs a statement that returns no rows.</summary>
        public void Run()
        {
            Step();
        }

        /// <summary>Ready the statement for another run with new bindings.</summary>
        public void Reset()
        {
            sqlite3_reset(_stmt);
            sqlite3_clear_bindings(_stmt);
        }

        public bool IsNull(int col) => sqlite3_column_type(_stmt, col) == SQLITE_NULL;

        public long Int64(int col) => sqlite3_column_int64(_stmt, col);

        public string? Text(int col)
        {
            if (IsNull(col)) return null;
            var p = sqlite3_column_text16(_stmt, col);
            var bytes = sqlite3_column_bytes16(_stmt, col);
            return p == null ? string.Empty : new string(p, 0, bytes / 2);
        }

        public byte[]? Blob(int col)
        {
            if (IsNull(col)) return null;
            var p = sqlite3_column_blob(_stmt, col);
            var bytes = sqlite3_column_bytes(_stmt, col);
            return p == null ? [] : new ReadOnlySpan<byte>(p, bytes).ToArray();
        }

        public void Dispose()
        {
            if (_stmt == IntPtr.Zero) return;
            sqlite3_finalize(_stmt);
            _stmt = IntPtr.Zero;
        }
    }
}

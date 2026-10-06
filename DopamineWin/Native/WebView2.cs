using System.Runtime.InteropServices;

namespace DopamineWin.Native;

/// <summary>
/// The few WebView2 calls the dashboard window needs, made straight through COM vtables so Native
/// AOT needs no interop assemblies. Slot numbers and IIDs come from WebView2.h in the
/// Microsoft.Web.WebView2 SDK; each interface only ever grows at the end, so they stay valid.
/// The loader is linked into the exe (see DopamineWin.csproj), so there is no DLL to ship.
/// </summary>
internal static unsafe class WebView2
{
    public const int S_OK = 0;

    [DllImport("WebView2Loader")]
    public static extern int CreateCoreWebView2EnvironmentWithOptions(char* browserFolder, char* userDataFolder, IntPtr options, IntPtr handler);

    // Interface ids
    private static readonly Guid IID_IUnknown = new("00000000-0000-0000-C000-000000000046");
    public static readonly Guid IID_EnvironmentCompleted = new("4e8a3389-c9d8-4bd2-b6b5-124fee6cc14d");
    public static readonly Guid IID_ControllerCompleted = new("6c4819f3-c9b7-4260-8127-c9f5bde7f68c");
    public static readonly Guid IID_NewWindowRequested = new("d4c185fe-c81c-4989-97af-2d3fa7ab5651");
    public static readonly Guid IID_NavigationStarting = new("9adbe429-f36d-432b-9ddc-f8881fbd76e3");
    public static readonly Guid IID_NavigationCompleted = new("d33a35bf-1c49-4f98-93ab-006e0533fe1c");
    public static readonly Guid IID_WebMessageReceived = new("57213f19-00e6-49fa-8e07-898ea01ecbd2");
    public static readonly Guid IID_Controller2 = new("c979903e-d4ca-4228-92eb-47ee3fa96eab");
    public static readonly Guid IID_Settings3 = new("fdb5ab74-af33-4854-84f0-0a631deb5eba");
    public static readonly Guid IID_Settings9 = new("0528a73b-e92d-49f4-927a-e547dddaa37d");

    private static void** Vtbl(IntPtr obj) => *(void***)obj;

    // IUnknown
    public static uint AddRef(IntPtr obj) => ((delegate* unmanaged[Stdcall]<IntPtr, uint>)Vtbl(obj)[1])(obj);

    public static void Release(ref IntPtr obj)
    {
        if (obj == IntPtr.Zero) return;
        ((delegate* unmanaged[Stdcall]<IntPtr, uint>)Vtbl(obj)[2])(obj);
        obj = IntPtr.Zero;
    }

    public static IntPtr QueryInterface(IntPtr obj, Guid iid)
    {
        IntPtr result;
        return ((delegate* unmanaged[Stdcall]<IntPtr, Guid*, IntPtr*, int>)Vtbl(obj)[0])(obj, &iid, &result) >= 0 ? result : IntPtr.Zero;
    }

    // ICoreWebView2Environment
    public static int CreateController(IntPtr environment, IntPtr parent, IntPtr handler) =>
        ((delegate* unmanaged[Stdcall]<IntPtr, IntPtr, IntPtr, int>)Vtbl(environment)[3])(environment, parent, handler);

    // ICoreWebView2Controller
    public static int SetVisible(IntPtr controller, bool visible) =>
        ((delegate* unmanaged[Stdcall]<IntPtr, int, int>)Vtbl(controller)[4])(controller, visible ? 1 : 0);

    public static int SetBounds(IntPtr controller, Win32.RECT bounds) =>
        ((delegate* unmanaged[Stdcall]<IntPtr, Win32.RECT, int>)Vtbl(controller)[6])(controller, bounds);

    public static int MoveFocus(IntPtr controller) =>
        ((delegate* unmanaged[Stdcall]<IntPtr, int, int>)Vtbl(controller)[12])(controller, 0); // PROGRAMMATIC

    public static int NotifyParentWindowPositionChanged(IntPtr controller) =>
        ((delegate* unmanaged[Stdcall]<IntPtr, int>)Vtbl(controller)[23])(controller);

    public static int Close(IntPtr controller) => ((delegate* unmanaged[Stdcall]<IntPtr, int>)Vtbl(controller)[24])(controller);

    public static IntPtr GetCoreWebView2(IntPtr controller)
    {
        IntPtr webview;
        return ((delegate* unmanaged[Stdcall]<IntPtr, IntPtr*, int>)Vtbl(controller)[25])(controller, &webview) >= 0 ? webview : IntPtr.Zero;
    }

    // ICoreWebView2Controller2. COREWEBVIEW2_COLOR is four bytes, A R G B, passed by value.
    public static int SetDefaultBackgroundColor(IntPtr controller2, byte r, byte g, byte b) =>
        ((delegate* unmanaged[Stdcall]<IntPtr, uint, int>)Vtbl(controller2)[27])(controller2, 0xFFu | (uint)r << 8 | (uint)g << 16 | (uint)b << 24);

    // ICoreWebView2
    public static IntPtr GetSettings(IntPtr webview)
    {
        IntPtr settings;
        return ((delegate* unmanaged[Stdcall]<IntPtr, IntPtr*, int>)Vtbl(webview)[3])(webview, &settings) >= 0 ? settings : IntPtr.Zero;
    }

    public static int Navigate(IntPtr webview, string uri)
    {
        fixed (char* u = uri) return ((delegate* unmanaged[Stdcall]<IntPtr, char*, int>)Vtbl(webview)[5])(webview, u);
    }

    public static int PostWebMessageAsJson(IntPtr webview, string json)
    {
        fixed (char* j = json) return ((delegate* unmanaged[Stdcall]<IntPtr, char*, int>)Vtbl(webview)[32])(webview, j);
    }

    public static int AddNavigationStarting(IntPtr webview, IntPtr handler) => AddEvent(webview, 7, handler);
    public static int AddNavigationCompleted(IntPtr webview, IntPtr handler) => AddEvent(webview, 15, handler);
    public static int AddWebMessageReceived(IntPtr webview, IntPtr handler) => AddEvent(webview, 34, handler);
    public static int AddNewWindowRequested(IntPtr webview, IntPtr handler) => AddEvent(webview, 44, handler);

    private static int AddEvent(IntPtr webview, int slot, IntPtr handler)
    {
        long token; // EventRegistrationToken; the handlers live as long as the webview, so it is never removed
        return ((delegate* unmanaged[Stdcall]<IntPtr, IntPtr, long*, int>)Vtbl(webview)[slot])(webview, handler, &token);
    }

    // ICoreWebView2Settings
    public static int SetStatusBarEnabled(IntPtr settings, bool enabled) => SetBool(settings, 10, enabled);
    public static int SetDevToolsEnabled(IntPtr settings, bool enabled) => SetBool(settings, 12, enabled);

    // ICoreWebView2Settings3 and 9: each extends the one before, so the slots keep counting.
    public static int SetBrowserAcceleratorKeysEnabled(IntPtr settings3, bool enabled) => SetBool(settings3, 24, enabled);

    /// <summary>Lets the page mark its own title bar with the CSS <c>app-region: drag</c> (runtime 1.0.2420 and later).</summary>
    public static int SetNonClientRegionSupportEnabled(IntPtr settings9, bool enabled) => SetBool(settings9, 38, enabled);

    private static int SetBool(IntPtr obj, int slot, bool value) =>
        ((delegate* unmanaged[Stdcall]<IntPtr, int, int>)Vtbl(obj)[slot])(obj, value ? 1 : 0);

    // Event args. Slot 3 is get_Uri on NewWindowRequested and NavigationStarting args, and get_Source
    // (the page's address) on WebMessageReceived args, so GetUri reads all three.
    public static string GetUri(IntPtr args)
    {
        char* uri;
        if (((delegate* unmanaged[Stdcall]<IntPtr, char**, int>)Vtbl(args)[3])(args, &uri) < 0 || uri == null) return string.Empty;
        try
        {
            return new string(uri);
        }
        finally
        {
            Marshal.FreeCoTaskMem((IntPtr)uri);
        }
    }

    /// <summary>What the page sent with <c>chrome.webview.postMessage("…")</c>; null if it sent anything but a string.</summary>
    public static string? GetWebMessageAsString(IntPtr args)
    {
        char* message;
        if (((delegate* unmanaged[Stdcall]<IntPtr, char**, int>)Vtbl(args)[5])(args, &message) < 0 || message == null) return null;
        try
        {
            return new string(message);
        }
        finally
        {
            Marshal.FreeCoTaskMem((IntPtr)message);
        }
    }

    public static int SetNewWindowHandled(IntPtr args) => SetBool(args, 6, true);
    public static int CancelNavigation(IntPtr args) => SetBool(args, 8, true);

    public static bool NavigationSucceeded(IntPtr args)
    {
        int success;
        return ((delegate* unmanaged[Stdcall]<IntPtr, int*, int>)Vtbl(args)[3])(args, &success) >= 0 && success != 0;
    }

    /// <summary>
    /// A COM object implementing one of WebView2's handler interfaces. They all have a single
    /// Invoke(this, a, b) after IUnknown: completion handlers get (HRESULT, result) and event
    /// handlers (sender, args), so one vtable serves them all.
    /// </summary>
    public static IntPtr Handler(Guid iid, Action<IntPtr, IntPtr> invoke)
    {
        var obj = (HandlerObject*)NativeMemory.Alloc((nuint)sizeof(HandlerObject));
        obj->Vtbl = HandlerVtbl;
        obj->Refs = 1;
        obj->Iid = iid;
        obj->Callback = GCHandle.ToIntPtr(GCHandle.Alloc(invoke));
        return (IntPtr)obj;
    }

    /// <summary>The HRESULT a completion handler receives as its first argument.</summary>
    public static int HResult(IntPtr first) => unchecked((int)(long)first);

    [StructLayout(LayoutKind.Sequential)]
    private struct HandlerObject
    {
        public void** Vtbl;
        public int Refs;
        public Guid Iid;
        public IntPtr Callback;
    }

    private static readonly void** HandlerVtbl = CreateHandlerVtbl();

    private static void** CreateHandlerVtbl()
    {
        var vtbl = (void**)NativeMemory.Alloc((nuint)(4 * sizeof(void*)));
        vtbl[0] = (delegate* unmanaged[Stdcall]<HandlerObject*, Guid*, IntPtr*, int>)&HandlerQueryInterface;
        vtbl[1] = (delegate* unmanaged[Stdcall]<HandlerObject*, uint>)&HandlerAddRef;
        vtbl[2] = (delegate* unmanaged[Stdcall]<HandlerObject*, uint>)&HandlerRelease;
        vtbl[3] = (delegate* unmanaged[Stdcall]<HandlerObject*, IntPtr, IntPtr, int>)&HandlerInvoke;
        return vtbl;
    }

    [UnmanagedCallersOnly(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvStdcall)])]
    private static int HandlerQueryInterface(HandlerObject* self, Guid* iid, IntPtr* result)
    {
        if (*iid == IID_IUnknown || *iid == self->Iid)
        {
            Interlocked.Increment(ref self->Refs);
            *result = (IntPtr)self;
            return S_OK;
        }

        *result = IntPtr.Zero;
        return unchecked((int)0x80004002); // E_NOINTERFACE
    }

    [UnmanagedCallersOnly(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvStdcall)])]
    private static uint HandlerAddRef(HandlerObject* self) => (uint)Interlocked.Increment(ref self->Refs);

    [UnmanagedCallersOnly(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvStdcall)])]
    private static uint HandlerRelease(HandlerObject* self)
    {
        var refs = Interlocked.Decrement(ref self->Refs);
        if (refs == 0)
        {
            GCHandle.FromIntPtr(self->Callback).Free();
            NativeMemory.Free(self);
        }

        return (uint)refs;
    }

    [UnmanagedCallersOnly(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvStdcall)])]
    private static int HandlerInvoke(HandlerObject* self, IntPtr a, IntPtr b)
    {
        try
        {
            ((Action<IntPtr, IntPtr>)GCHandle.FromIntPtr(self->Callback).Target!)(a, b);
        }
        catch (Exception ex)
        {
            Log.Error("WebView2 callback failed", ex);
        }

        return S_OK;
    }
}

package com.easyphotoprint.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.annotation.Nullable;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;

/**
 * Wraps the Storage Access Framework intents (ACTION_OPEN_DOCUMENT, ACTION_CREATE_DOCUMENT) that
 * back dialog.openImages/relinkImage and fs.openProject/saveProject on Android -- the counterpart
 * to Electron's native file dialogs. See openspec/changes/android-shell/design.md, Decision 3.
 */
@CapacitorPlugin(name = "SafFile")
public class SafFilePlugin extends Plugin {

    @PluginMethod
    public void openImages(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] { "image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/tiff" }
        );
        startActivityForResult(call, intent, "openImagesResult");
    }

    @ActivityCallback
    private void openImagesResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        JSArray files = new JSArray();
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            List<Uri> uris = new ArrayList<>();
            Intent data = result.getData();
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                for (int i = 0; i < count; i++) {
                    uris.add(data.getClipData().getItemAt(i).getUri());
                }
            } else if (data.getData() != null) {
                uris.add(data.getData());
            }

            for (Uri uri : uris) {
                try {
                    files.put(readUriAsJs(uri));
                } catch (IOException | JSONException e) {
                    // Skip a file the app can't read rather than failing the whole selection --
                    // the caller (androidAdapter.ts) still gets every file that did succeed.
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("files", files);
        call.resolve(ret);
    }

    @PluginMethod
    public void openDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        JSArray mimeTypes = call.getArray("mimeTypes");
        intent.setType("*/*");
        if (mimeTypes != null && mimeTypes.length() > 0) {
            try {
                String[] types = new String[mimeTypes.length()];
                for (int i = 0; i < mimeTypes.length(); i++) {
                    types[i] = mimeTypes.getString(i);
                }
                intent.putExtra(Intent.EXTRA_MIME_TYPES, types);
            } catch (JSONException e) {
                call.reject("Invalid mimeTypes array", e);
                return;
            }
        }
        startActivityForResult(call, intent, "openDocumentResult");
    }

    @ActivityCallback
    private void openDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("file", JSObject.NULL));
            return;
        }

        try {
            JSObject file = readUriAsJs(result.getData().getData());
            call.resolve(new JSObject().put("file", file));
        } catch (IOException | JSONException e) {
            call.reject("Failed to read the selected document", e);
        }
    }

    @PluginMethod
    public void createDocument(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String base64 = call.getString("base64");
        if (fileName == null || base64 == null) {
            call.reject("Must provide fileName and base64");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        // Stash the payload on the call's saved state isn't available across the activity-result
        // round-trip, so it's threaded through as a call parameter read back in the callback.
        startActivityForResult(call, intent, "createDocumentResult");
    }

    @ActivityCallback
    private void createDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("uri", JSObject.NULL));
            return;
        }

        Uri uri = result.getData().getData();
        String base64 = call.getString("base64");
        try {
            writeBytes(uri, Base64.decode(base64, Base64.DEFAULT));
            call.resolve(new JSObject().put("uri", uri.toString()));
        } catch (IOException e) {
            call.reject("Failed to write the created document", e);
        }
    }

    @PluginMethod
    public void writeDocument(PluginCall call) {
        String uriString = call.getString("uri");
        String base64 = call.getString("base64");
        if (uriString == null || base64 == null) {
            call.reject("Must provide uri and base64");
            return;
        }

        try {
            writeBytes(Uri.parse(uriString), Base64.decode(base64, Base64.DEFAULT));
            call.resolve();
        } catch (IOException e) {
            call.reject("Failed to write to " + uriString, e);
        }
    }

    private JSObject readUriAsJs(Uri uri) throws IOException, JSONException {
        ContentResolver resolver = getContext().getContentResolver();
        byte[] bytes = readBytes(resolver, uri);
        JSObject obj = new JSObject();
        obj.put("uri", uri.toString());
        obj.put("fileName", queryDisplayName(resolver, uri));
        obj.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
        return obj;
    }

    private byte[] readBytes(ContentResolver resolver, Uri uri) throws IOException {
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) {
                throw new IOException("openInputStream returned null for " + uri);
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[16 * 1024];
            int read;
            while ((read = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
            return buffer.toByteArray();
        }
    }

    private void writeBytes(Uri uri, byte[] bytes) throws IOException {
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) {
                throw new IOException("openOutputStream returned null for " + uri);
            }
            output.write(bytes);
        }
    }

    @Nullable
    private String queryDisplayName(ContentResolver resolver, Uri uri) {
        try (android.database.Cursor cursor = resolver.query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    return cursor.getString(index);
                }
            }
        }
        return uri.getLastPathSegment();
    }
}

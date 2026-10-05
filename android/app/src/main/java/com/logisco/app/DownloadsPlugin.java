package com.logisco.app;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves a file the page built - a report, a CSV - and opens it.
 *
 * In a browser a page downloads a file it made by clicking a link to it. The
 * WebView this app runs the site in has no download manager behind that link,
 * so the click went nowhere: the office pressed Export on a phone and nothing
 * happened. The page hands the file here instead.
 *
 * Android 10 and later: into the phone's Downloads, where a file someone
 * downloaded is looked for, and no permission is needed for it. Before that,
 * writing to Downloads needs a storage permission this app has no other use
 * for, so the file is kept in the app's own folder - and opened straight away,
 * which is the part that matters there.
 */
@CapacitorPlugin(name = "Downloads")
public class DownloadsPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (data == null || filename == null || filename.trim().isEmpty()) {
            call.reject("A file needs its contents and a name.");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("The file could not be read.", error);
            return;
        }

        try {
            Uri uri;
            boolean inDownloads;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Downloads refused the file.");

                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("Downloads refused the file.");
                    out.write(bytes);
                }

                // Visible to other apps only once it is all there.
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                inDownloads = true;
            } else {
                File folder = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (folder == null) folder = new File(getContext().getCacheDir(), "downloads");
                if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("No folder to save into.");

                File file = new File(folder, filename);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                inDownloads = false;
            }

            boolean opened = open(uri, mimeType);

            JSObject result = new JSObject();
            result.put("inDownloads", inDownloads);
            result.put("opened", opened);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("The file could not be saved.", error);
        }
    }

    /** In whatever the phone opens that kind of file with. False when nothing can. */
    private boolean open(Uri uri, String mimeType) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, mimeType);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException error) {
            return false;
        }
    }
}

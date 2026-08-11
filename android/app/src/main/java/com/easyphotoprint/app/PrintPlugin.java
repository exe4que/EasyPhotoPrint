package com.easyphotoprint.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Opens Android's native print dialog for an already-composed PDF (produced by the in-WebView
 * compositor, see src/lib/android/composeProjectPdf.ts). Reusing that compositor for both
 * pdf.export and print.document -- rather than driving print through the WebView's own
 * window.print() -- is what keeps their output identical, per the printing capability's
 * requirements. See openspec/changes/android-shell/design.md, Decision 5.
 */
@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {

    @PluginMethod
    public void printPdf(PluginCall call) {
        String base64 = call.getString("base64");
        String jobName = call.getString("jobName", "Document");
        if (base64 == null) {
            call.reject("Must provide base64");
            return;
        }

        byte[] pdfBytes = Base64.decode(base64, Base64.DEFAULT);
        PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
        if (printManager == null) {
            call.reject("Printing is not available on this device");
            return;
        }

        printManager.print(jobName, new PdfBytesDocumentAdapter(jobName, pdfBytes), null);
        call.resolve();
    }

    private static class PdfBytesDocumentAdapter extends PrintDocumentAdapter {

        private final String jobName;
        private final byte[] pdfBytes;

        PdfBytesDocumentAdapter(String jobName, byte[] pdfBytes) {
            this.jobName = jobName;
            this.pdfBytes = pdfBytes;
        }

        @Override
        public void onLayout(
            PrintAttributes oldAttributes,
            PrintAttributes newAttributes,
            CancellationSignal cancellationSignal,
            LayoutResultCallback callback,
            Bundle extras
        ) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }

            PrintDocumentInfo info = new PrintDocumentInfo.Builder(jobName + ".pdf")
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .build();
            callback.onLayoutFinished(info, !newAttributes.equals(oldAttributes));
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
            try (
                InputStream input = new ByteArrayInputStream(pdfBytes);
                OutputStream output = new FileOutputStream(destination.getFileDescriptor())
            ) {
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    if (cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    output.write(buffer, 0, read);
                }
                callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
            } catch (IOException e) {
                callback.onWriteFailed(e.getMessage());
            }
        }
    }
}
